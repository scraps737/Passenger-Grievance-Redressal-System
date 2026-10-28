import { Message } from '../models/Message.js';
import { Grievance } from '../models/Grievance.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { assertCanAccess } from './grievanceController.js';
import { addTimelineEvent } from '../services/timelineService.js';
import { notify } from '../services/notificationService.js';
import { GRIEVANCE_STATUS, NOTIFICATION_TYPES, ROLES, TIMELINE_EVENT_TYPES, USER_STATUS } from '../config/constants.js';
import { User } from '../models/User.js';

export const listMessages = asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.id);
  assertCanAccess(grievance, req.user);
  const messages = await Message.find({ grievance: grievance._id })
    .sort({ createdAt: 1 })
    .populate('sender', 'name role designation employeeId')
    .lean();
  res.json({ success: true, messages });
});

export const postMessage = asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.id);
  assertCanAccess(grievance, req.user);

  const { body, kind } = req.body;
  let resolvedKind = kind;

  if (req.user.role === ROLES.PASSENGER) {
    // Passengers may only reply normally or answer a clarification request.
    if (!['message', 'clarification_response'].includes(kind)) {
      resolvedKind = 'message';
    }
    if (
      resolvedKind === 'clarification_response' &&
      grievance.status === GRIEVANCE_STATUS.AWAITING_CLARIFICATION
    ) {
      grievance.status = GRIEVANCE_STATUS.IN_PROGRESS;
      grievance.clarification.respondedAt = new Date();
      await grievance.save();
    }
  }

  if (resolvedKind === 'clarification_request') {
    if (req.user.role === ROLES.PASSENGER) throw ApiError.forbidden();
    grievance.clarification.requested = true;
    grievance.clarification.requestedAt = new Date();
    if (grievance.status !== GRIEVANCE_STATUS.AWAITING_CLARIFICATION) {
      grievance.status = GRIEVANCE_STATUS.AWAITING_CLARIFICATION;
    }
    await grievance.save();
  }

  const message = await Message.create({
    grievance: grievance._id,
    sender: req.user._id,
    senderRole: req.user.role,
    body,
    kind: resolvedKind,
    attachments: (req.files || []).map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
    })),
  });

  await addTimelineEvent({
    grievance: grievance._id,
    type:
      resolvedKind === 'clarification_request'
        ? TIMELINE_EVENT_TYPES.CLARIFICATION_REQUESTED
        : resolvedKind === 'clarification_response'
          ? TIMELINE_EVENT_TYPES.CLARIFICATION_RESPONDED
          : TIMELINE_EVENT_TYPES.MESSAGE,
    title:
      resolvedKind === 'clarification_request'
        ? 'Clarification requested'
        : resolvedKind === 'clarification_response'
          ? 'Passenger responded to clarification'
          : `Message from ${req.user.name}`,
    description: body.slice(0, 300),
    actor: req.user,
  });

  // Notify the counterparties on the thread.
  if (req.user.role === ROLES.PASSENGER) {
    const recipients = [];
    if (grievance.assignedOfficer) recipients.push(grievance.assignedOfficer);
    else if (grievance.department) {
      const officers = await User.find({
        role: ROLES.OFFICER,
        department: grievance.department,
        status: USER_STATUS.ACTIVE,
      })
        .select('_id')
        .limit(5);
      recipients.push(...officers.map((o) => o._id));
    }
    await Promise.all(
      recipients.map((r) =>
        notify({
          user: r,
          title: `New message on ${grievance.referenceId}`,
          body: body.slice(0, 140),
          type: NOTIFICATION_TYPES.MESSAGE,
          grievance: grievance._id,
          referenceId: grievance.referenceId,
          link: `/officer/cases/${grievance._id}`,
        })
      )
    );
  } else {
    await notify({
      user: grievance.passenger,
      title:
        resolvedKind === 'clarification_request'
          ? `Clarification needed on ${grievance.referenceId}`
          : `New message on ${grievance.referenceId}`,
      body: body.slice(0, 160),
      type:
        resolvedKind === 'clarification_request'
          ? NOTIFICATION_TYPES.CLARIFICATION
          : NOTIFICATION_TYPES.MESSAGE,
      grievance: grievance._id,
      referenceId: grievance.referenceId,
      priority: resolvedKind === 'clarification_request' ? 'high' : 'normal',
      link: `/passenger/grievances/${grievance._id}`,
    });
  }

  const populated = await message.populate('sender', 'name role designation employeeId');
  res.status(201).json({ success: true, message: populated });
});
