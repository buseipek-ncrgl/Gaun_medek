import mongoose from "mongoose";

const DepartmentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // null değerlere izin ver ama unique olsun
    },
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    programOutcomes: [
      {
        code: {
          type: String,
          required: true,
          trim: true,
        },
        description: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Department", DepartmentSchema);

