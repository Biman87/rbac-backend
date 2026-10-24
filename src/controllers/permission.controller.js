// src/controllers/permission.controller.js
// Handles Permission CRUD and Role ↔ Permission assignment.
// All routes are ADMIN-only — enforced at the router level.

import prisma from '../config/prisma.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

// ─── Shared select shape ──────────────────────────────────────────────────────

const PERMISSION_SELECT = {
  id: true,
  name: true,
  action: true,
  resource: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function findPermissionOrFail(id) {
  const permission = await prisma.permission.findUnique({
    where: { id },
    select: PERMISSION_SELECT,
  });
  if (!permission) throw new AppError(`No permission found with ID: ${id}`, 404);
  return permission;
}

async function findRoleOrFail(id) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new AppError(`No role found with ID: ${id}`, 404);
  return role;
}

// ════════════════════════════════════════════════════════════════════════════
//  PERMISSION CRUD  —  endpoints 10-14
// ════════════════════════════════════════════════════════════════════════════

// ─── GET /api/v1/permissions  (#10) ───────────────────────────────────────────

/**
 * Lists all permissions sorted by resource then action.
 * Includes a count of how many roles carry each permission.
 */
export const getAllPermissions = catchAsync(async (req, res) => {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    select: {
      ...PERMISSION_SELECT,
      _count: { select: { roles: true } },
    },
  });

  res.status(200).json({
    status: 'success',
    results: permissions.length,
    data: { permissions },
  });
});

// ─── GET /api/v1/permissions/:id  (#11) ───────────────────────────────────────

export const getPermissionById = catchAsync(async (req, res, next) => {
  const permission = await prisma.permission.findUnique({
    where: { id: req.params.id },
    select: {
      ...PERMISSION_SELECT,
      roles: {
        select: {
          role: { select: { id: true, name: true } },
          assignedAt: true,
        },
      },
    },
  });

  if (!permission) {
    return next(new AppError(`No permission found with ID: ${req.params.id}`, 404));
  }

  res.status(200).json({
    status: 'success',
    data: { permission },
  });
});

// ─── POST /api/v1/permissions  (#12) ──────────────────────────────────────────

/**
 * Creates a new permission.
 * Prisma P2002 on (action, resource) unique pair → 409 via global error handler.
 */
export const createPermission = catchAsync(async (req, res) => {
  const { name, action, resource, description } = req.body;

  const permission = await prisma.permission.create({
    data: { name, action, resource, description },
    select: PERMISSION_SELECT,
  });

  res.status(201).json({
    status: 'success',
    data: { permission },
  });
});

// ─── PATCH /api/v1/permissions/:id  (#13) ────────────────────────────────────

export const updatePermission = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await findPermissionOrFail(id);

  const { name, action, resource, description } = req.body;

  const updateData = {};
  if (name        !== undefined) updateData.name        = name;
  if (action      !== undefined) updateData.action      = action;
  if (resource    !== undefined) updateData.resource    = resource;
  if (description !== undefined) updateData.description = description;

  const permission = await prisma.permission.update({
    where: { id },
    data: updateData,
    select: PERMISSION_SELECT,
  });

  res.status(200).json({
    status: 'success',
    data: { permission },
  });
});

// ─── DELETE /api/v1/permissions/:id  (#14) ───────────────────────────────────

/**
 * Deletes a permission. The RolePermission join rows are cascade-deleted
 * automatically by the DB constraint, so no manual cleanup is needed.
 */
export const deletePermission = catchAsync(async (req, res, next) => {
  await findPermissionOrFail(req.params.id);

  await prisma.permission.delete({ where: { id: req.params.id } });

  res.status(204).send();
});

// ════════════════════════════════════════════════════════════════════════════
//  ROLE ↔ PERMISSION ASSIGNMENT  —  endpoints 15-17
// ════════════════════════════════════════════════════════════════════════════

// ─── GET /api/v1/roles/:id/permissions  (#15) ────────────────────────────────

/**
 * Returns all permissions currently assigned to a role.
 */
export const getRolePermissions = catchAsync(async (req, res, next) => {
  await findRoleOrFail(req.params.id);

  const roleWithPerms = await prisma.role.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      permissions: {
        select: {
          assignedAt: true,
          permission: { select: PERMISSION_SELECT },
        },
        orderBy: { permission: { resource: 'asc' } },
      },
    },
  });

  // Flatten: return the permission objects with assignedAt alongside them
  const permissions = roleWithPerms.permissions.map(({ permission, assignedAt }) => ({
    ...permission,
    assignedAt,
  }));

  res.status(200).json({
    status: 'success',
    results: permissions.length,
    data: {
      role: { id: roleWithPerms.id, name: roleWithPerms.name },
      permissions,
    },
  });
});

// ─── POST /api/v1/roles/:id/permissions  (#16) ───────────────────────────────

/**
 * Assigns one or more permissions to a role.
 * Body: { permissionIds: string[] }
 *
 * Uses createMany + skipDuplicates so re-assigning an already-held permission
 * is silently ignored rather than throwing a 409.
 *
 * Returns 400 if any of the provided permissionIds don't exist.
 */
export const assignPermissionsToRole = catchAsync(async (req, res, next) => {
  const { id: roleId } = req.params;
  const { permissionIds } = req.body;

  await findRoleOrFail(roleId);

  // Validate all permissionIds exist in one query
  const found = await prisma.permission.findMany({
    where: { id: { in: permissionIds } },
    select: { id: true },
  });

  if (found.length !== permissionIds.length) {
    const foundIds = new Set(found.map((p) => p.id));
    const missing = permissionIds.filter((pid) => !foundIds.has(pid));
    return next(
      new AppError(`The following permission IDs do not exist: ${missing.join(', ')}`, 400)
    );
  }

  await prisma.rolePermission.createMany({
    data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    skipDuplicates: true,
  });

  // Re-fetch the full updated permission list to return
  const updated = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      name: true,
      permissions: {
        select: {
          assignedAt: true,
          permission: { select: PERMISSION_SELECT },
        },
      },
    },
  });

  const permissions = updated.permissions.map(({ permission, assignedAt }) => ({
    ...permission,
    assignedAt,
  }));

  res.status(200).json({
    status: 'success',
    results: permissions.length,
    data: {
      role: { id: updated.id, name: updated.name },
      permissions,
    },
  });
});

// ─── DELETE /api/v1/roles/:id/permissions/:permissionId  (#17) ───────────────

/**
 * Removes a single permission from a role.
 * Throws 404 if the role, the permission, or the assignment doesn't exist.
 */
export const removePermissionFromRole = catchAsync(async (req, res, next) => {
  const { id: roleId, permissionId } = req.params;

  await findRoleOrFail(roleId);
  await findPermissionOrFail(permissionId);

  // Check the assignment actually exists before attempting delete
  const assignment = await prisma.rolePermission.findUnique({
    where: { roleId_permissionId: { roleId, permissionId } },
  });

  if (!assignment) {
    return next(
      new AppError(`Permission is not assigned to this role.`, 404)
    );
  }

  await prisma.rolePermission.delete({
    where: { roleId_permissionId: { roleId, permissionId } },
  });

  res.status(204).send();
});
