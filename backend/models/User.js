import mongoose from "mongoose";
import bcrypt from "bcrypt";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["super_admin", "department_head", "teacher"],
      required: true,
      default: "teacher",
    },
    // Bölüm başkanı: bu bölüme atanır. Öğretmen: hangi bölüme bağlı (isteğe bağlı)
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    // Öğretmen: hangi program(lar)a atanır (bölüm içindeki programlar)
    assignedProgramIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Program",
      },
    ],
    // Öğretmen: hangi derslere atanır
    assignedCourseIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ departmentId: 1 });
UserSchema.index({ assignedCourseIds: 1 });

UserSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

const User = mongoose.model("User", UserSchema);
export default User;
