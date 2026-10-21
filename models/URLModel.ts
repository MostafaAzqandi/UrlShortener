import type { Document } from "mongoose";
import mongoose, { Schema } from "mongoose";

export interface IURLDocument extends Document {
  url: string;
  slug: string;
  updatedAt: Date;
  createdAt: Date;
}
const URLSchema = new Schema<IURLDocument>(
  {
    url: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v: string) => {
          try {
            const parsed = new URL(v);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
          } catch {
            return false;
          }
        },
        message: "Must be a valid http(s) URL",
      },
    },
    slug: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);
export const URLModel = mongoose.model<IURLDocument>("URLModel", URLSchema);
