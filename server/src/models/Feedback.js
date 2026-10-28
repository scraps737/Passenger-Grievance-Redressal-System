import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    grievance: { type: mongoose.Schema.Types.ObjectId, ref: 'Grievance', required: true, unique: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 2000, default: '' },
    resolvedWithinSla: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Feedback = mongoose.model('Feedback', feedbackSchema);
