import { User } from '../models/User.js';
import { Grievance } from '../models/Grievance.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { recordAudit } from '../services/auditService.js';
import { ACTIVE_STATUSES, ROLES, USER_STATUS } from '../config/constants.js';

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { role, status, department, search, zone } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (department) filter.department = department;
  if (zone) filter.zone = zone;
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { employeeId: rx }];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-password')
      .populate('department', 'name code')
      .lean(),
    User.countDocuments(filter),
  ]);

  const counts = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
  ]);

  res.json({
    success: true,
    items,
    roleCounts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, employeeId, designation, department, zone, division } = req.body;
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    employeeId,
    designation,
    department: department || null,
    zone,
    division,
    status: USER_STATUS.ACTIVE,
  });

  await recordAudit({
    req,
    action: 'user.created',
    entity: 'User',
    entityId: user._id,
    description: `Created ${role} account ${email}`,
    severity: 'warning',
  });

  res.status(201).json({ success: true, user: user.toSafeJSON() });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  const updates = req.body;
  const before = { role: user.role, status: user.status };

  for (const key of ['name', 'phone', 'role', 'status', 'employeeId', 'designation', 'zone', 'division']) {
    if (updates[key] !== undefined) user[key] = updates[key];
  }
  if (updates.department !== undefined) user.department = updates.department || null;
  await user.save();

  await recordAudit({
    req,
    action: 'user.updated',
    entity: 'User',
    entityId: user._id,
    description: `Updated user ${user.email}`,
    severity: before.role !== user.role || before.status !== user.status ? 'critical' : 'warning',
    meta: { before, after: { role: user.role, status: user.status } },
  });

  res.json({ success: true, user: user.toSafeJSON() });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (String(user._id) === String(req.user._id)) throw ApiError.badRequest('You cannot delete your own account');

  const activeCases = await Grievance.countDocuments({
    assignedOfficer: user._id,
    status: { $in: ACTIVE_STATUSES },
  });
  if (activeCases > 0) {
    throw ApiError.conflict(`Officer has ${activeCases} active case(s). Reassign them before removing the account.`);
  }

  await user.deleteOne();

  await recordAudit({
    req,
    action: 'user.deleted',
    entity: 'User',
    entityId: user._id,
    description: `Deleted account ${user.email}`,
    severity: 'critical',
  });

  res.json({ success: true });
});

export const listOfficers = asyncHandler(async (req, res) => {
  const filter = { role: { $in: [ROLES.OFFICER, ROLES.ADMIN] }, status: USER_STATUS.ACTIVE };
  if (req.query.department) filter.department = req.query.department;
  const officers = await User.find(filter)
    .select('name email employeeId designation department zone division')
    .populate('department', 'name code')
    .sort({ name: 1 })
    .lean();
  res.json({ success: true, officers });
});
