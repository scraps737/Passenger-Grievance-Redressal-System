import { Department } from '../models/Department.js';
import { Grievance } from '../models/Grievance.js';
import { User } from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { recordAudit } from '../services/auditService.js';
import { ACTIVE_STATUSES, ROLES, USER_STATUS } from '../config/constants.js';

export const listDepartments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.active === 'true') filter.active = true;
  if (req.query.zone) filter.zone = req.query.zone;
  if (req.query.division) filter.division = req.query.division;

  const departments = await Department.find(filter)
    .populate('head', 'name designation employeeId')
    .sort({ code: 1 })
    .lean();

  // Live operational metrics derived from real records.
  const enriched = await Promise.all(
    departments.map(async (dept) => {
      const [activeCases, totalCases, personnel, breached] = await Promise.all([
        Grievance.countDocuments({ department: dept._id, status: { $in: ACTIVE_STATUSES } }),
        Grievance.countDocuments({ department: dept._id }),
        User.countDocuments({ department: dept._id, role: ROLES.OFFICER, status: USER_STATUS.ACTIVE }),
        Grievance.countDocuments({ department: dept._id, 'sla.breached': true }),
      ]);
      return {
        ...dept,
        metrics: {
          activeCases,
          totalCases,
          personnel,
          breached,
          load: dept.capacity ? Math.min(100, Math.round((activeCases / dept.capacity) * 100)) : 0,
        },
      };
    })
  );

  res.json({ success: true, departments: enriched });
});

export const getDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id).populate('head', 'name designation');
  if (!department) throw ApiError.notFound('Department not found');
  res.json({ success: true, department });
});

export const createDepartment = asyncHandler(async (req, res) => {
  const exists = await Department.findOne({ code: req.body.code.toUpperCase() });
  if (exists) throw ApiError.conflict('A department with that code already exists');
  const department = await Department.create(req.body);
  await recordAudit({
    req,
    action: 'department.created',
    entity: 'Department',
    entityId: department._id,
    description: `Created department ${department.code}`,
    severity: 'warning',
  });
  res.status(201).json({ success: true, department });
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!department) throw ApiError.notFound('Department not found');
  await recordAudit({
    req,
    action: 'department.updated',
    entity: 'Department',
    entityId: department._id,
    description: `Updated department ${department.code}`,
    meta: req.body,
  });
  res.json({ success: true, department });
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw ApiError.notFound('Department not found');
  const activeCases = await Grievance.countDocuments({ department: department._id, status: { $in: ACTIVE_STATUSES } });
  if (activeCases > 0) {
    throw ApiError.conflict(`Department has ${activeCases} active case(s); deactivate it instead.`);
  }
  department.active = false;
  await department.save();
  await recordAudit({
    req,
    action: 'department.deactivated',
    entity: 'Department',
    entityId: department._id,
    description: `Deactivated department ${department.code}`,
    severity: 'critical',
  });
  res.json({ success: true });
});
