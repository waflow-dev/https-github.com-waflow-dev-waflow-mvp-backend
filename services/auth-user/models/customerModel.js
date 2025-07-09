import mongoose from "mongoose";

const investorSchema = new mongoose.Schema({
  name: String,
  passportNumber: String,
  shareholdingPercentage: Number,
  nationality: String,
  countryOfResidence: String,
  address: String,
  visaRequired: Boolean,
  documents: {
    passportCopy: String,
    photo: String,
    proofOfAddress: String,
    additionalDocs: [String],
  },
});

const customerSchema = new mongoose.Schema(
  {
    assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent" },

    // Agent/Manager-filled fields
    firstName: { type: String, required: true },
    middleName: { type: String },
    lastName: { type: String, required: true },
    dob: { type: Date, required: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    currentAddress: { type: String },
    permanentAddress: { type: String },
    nationality: { type: String, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    designation: { type: String },

    companyType: { type: String },
    jurisdiction: { type: String },
    businessActivity1: { type: String },
    officeType: { type: String },

    quotedPrice: { type: Number },
    paymentPlans: [{ type: String }],
    paymentDetails: { type: String },

    // Customer-filled fields
    businessActivity2: { type: String },
    businessActivity3: { type: String },
    numberOfInvestors: { type: Number },
    sourceOfFund: { type: String },
    initialInvestment: { type: Number },
    investorDetails: [investorSchema],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Customer", customerSchema);
