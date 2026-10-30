import mongoose from "mongoose";

const examSubmissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  examType: {
    type: String,
    enum: ["IQ", "EQ"],
    required: true,
  },
  answers: {
    type: [
      {
        questionId: { type: String, required: true, trim: true, maxlength: 120 },
        question: { type: String, trim: true, maxlength: 2000 },
        options: {
          type: [{ id: { type: String, required: true }, text: { type: String, required: true } }],
          default: undefined,
        },
        answer: { type: String, maxlength: 8 },
      },
    ],
    required: true,
    validate: {
      validator(answers) {
        return this.status === "Failed"
          ? answers.length <= 50
          : answers.length === 50;
      },
      message: "A completed exam must have 50 answers; a failed exam may have up to 50.",
    },
  },
  failureReason: {
    type: String,
    enum: [
      "tab_hidden",
      "window_blur",
      "screenshot_shortcut",
      "camera_stopped",
      "camera_disconnected",
      null,
    ],
    default: null,
  },
  proctoring: {
    cameraUsed: { type: Boolean, default: false },
    reviewerJoined: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  snapshots: {
    type: [
      {
        type: String,
        maxlength: 2048,
        validate: {
          validator: (value) => {
            try {
              const url = new URL(value);
              return url.protocol === "https:" && !url.username && !url.password;
            } catch {
              return false;
            }
          },
          message: "Snapshot links must be valid HTTPS URLs.",
        },
      },
    ],
    default: [],
    validate: {
      validator: (snapshots) => snapshots.length <= 10,
      message: "No more than 10 snapshot links are allowed.",
    },
  },
  tabSwitches: {
    type: Number,
    min: 0,
    max: 10000,
    required: true,
  },
  status: {
    type: String,
    enum: ["Pending_Review", "Approved", "Rejected", "Failed"],
    default: "Pending_Review",
  },
  finalScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

examSubmissionSchema.index({ status: 1, submittedAt: 1 });
examSubmissionSchema.index({ userId: 1, submittedAt: -1 });

const ExamSubmission = mongoose.model("ExamSubmission", examSubmissionSchema);

export default ExamSubmission;
