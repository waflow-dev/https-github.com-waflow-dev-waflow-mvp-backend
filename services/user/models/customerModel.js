import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  line1: { type: String, required: true },
  line2: { type: String }, // optional
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  zipcode: {
    type: String,
    required: true,
    match: [/^\d{4,10}$/, "Zipcode must be 4 to 10 digits"],
  },
});

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, unique: true }, // e.g. CX-0001

    assignedAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "agent",
      default: null,
    },

    // Personal Details
    firstName: {
      type: String,
      required: true,
      maxlength: 50,
      match: [/^[A-Za-z\s]+$/, "First name should contain alphabets only"],
    },
    middleName: {
      type: String,
      maxlength: 50,
      match: [/^[A-Za-z\s]*$/, "Middle name should contain alphabets only"],
    },
    lastName: {
      type: String,
      required: true,
      maxlength: 50,
      match: [/^[A-Za-z\s]+$/, "Last name should contain alphabets only"],
    },
    dob: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value < new Date();
        },
        message: "Date of birth must be a valid past date",
      },
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },

    // Contact Details
    email: {
      type: String,
      required: true,
      unique: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Invalid email address",
      ],
    },
    phoneNumber: {
      type: String,
      required: true,
      match: [/^\d{7,15}$/, "Phone number must be 7 to 15 digits"],
    },

    // Address & Nationality
    nationality: {
      type: String,
      required: true,
    },
    address: {
      type: addressSchema,
      required: true,
    },

    // Government IDs
    emiratesIdNumber: {
      type: String,
      match: [/^[a-zA-Z0-9]*$/, "Emirates ID must be alphanumeric"],
    },
    passportNumber: {
      type: String,
      required: true,
      maxlength: 20,
      match: [/^[a-zA-Z0-9]*$/, "Passport number must be alphanumeric"],
    },

    role: { type: String, default: "customer" },
  },
  { timestamps: true }
);

export default mongoose.model("Customer", customerSchema);
