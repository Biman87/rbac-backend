// src/controllers/role.controller.js
// CRUD handlers for the Role resource.
// All routes are restricted to ADMIN — enforced at the router level.

import prisma from '../config/prisma.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetches a role by its ID and throws a 404 AppError if not found.
 * @param {string} id
 * @returns {Promise<import('@prisma/client').Role>}
 */
async function findRoleOrFail(id) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    throw new AppError(`No role found with ID: ${id}`, 404);
  }
  return role;
}

// ─── GET /api/v1/roles ────────────────────────────────────────────────────────

/**
 * Returns all roles, sorted alphabetically by name.
 */
export const getAllRoles = catchAsync(async (req, res, next) => {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { users: true } }, // how many users are assigned this role
    },
  });

  res.status(200).json({
    status: 'success',
    results: roles.length,
    data: { roles },
  });
});

// ─── GET /api/v1/roles/:id ────────────────────────────────────────────────────

/**
 * Returns a single role by ID.
 * Throws 404 if the role does not exist.
 */
export const getRoleById = catchAsync(async (req, res, next) => {
  const role = await prisma.role.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { users: true } },
    },
  });

  if (!role) {
    return next(new AppError(`No role found with ID: ${req.params.id}`, 404));
  }

  res.status(200).json({
    status: 'success',
    data: { role },
  });
});

// ─── POST /api/v1/roles ───────────────────────────────────────────────────────

/**
 * Creates a new role.
 * - name is auto-uppercased by the Zod schema.
 * - Prisma will throw P2002 if the name already exists; the global error
 *   handler converts that to a 409 Conflict response automatically.
 */
export const createRole = catchAsync(async (req, res, next) => {
  const { name, description } = req.body;

  const role = await prisma.role.create({
    data: { name, description },
  });

  res.status(201).json({
    status: 'success',
    data: { role },
  });
});

// ─── PATCH /api/v1/roles/:id ──────────────────────────────────────────────────

/**
 * Partially updates an existing role.
 * - Throws 404 if the role does not exist (findRoleOrFail).
 * - Only the provided fields are updated (undefined values are excluded by
 *   Prisma's update semantics when the key is absent from `data`).
 * - Prisma will throw P2002 if the new name conflicts with another role.
 */
export const updateRole = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Confirm the role exists before attempting the update
  await findRoleOrFail(id);

  const { name, description } = req.body;

  // Build update payload — omit keys that were not supplied in the request
  const updateData = {};
  if (name !== undefined)        updateData.name        = name;
  if (description !== undefined) updateData.description = description;

  const role = await prisma.role.update({
    where: { id },
    data: updateData,
  });

  res.status(200).json({
    status: 'success',
    data: { role },
  });
});

// ─── DELETE /api/v1/roles/:id ─────────────────────────────────────────────────

/**
 * Deletes a role by ID.
 * - Throws 404 if the role does not exist.
 * - Throws 400 if the role is still assigned to one or more users, preventing
 *   accidental deletion of roles that are in active use.
 */
export const deleteRole = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Confirm existence first
  await findRoleOrFail(id);

  // Guard: prevent deletion if the role is still assigned to users
  const userCount = await prisma.user.count({ where: { roleId: id } });
  if (userCount > 0) {
    return next(
      new AppError(
        `Cannot delete role: it is currently assigned to ${userCount} user(s). Reassign them first.`,
        400
      )
    );
  }

  await prisma.role.delete({ where: { id } });

  // 204 No Content — body is intentionally empty
  res.status(204).send();
});
