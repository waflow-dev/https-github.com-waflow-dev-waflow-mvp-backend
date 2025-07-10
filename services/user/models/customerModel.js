import mongoose from "mongoose";

const investorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  passportNumber: { type: String },
  passportValidity: { type: String },
  shareholdingPercentage: { type: Number },
  role: { type: String },
  visaRequired: { type: Boolean },
  nationality: { type: String },
  countryOfResidence: { type: String },
  address: { type: String },
  documents: {
    passportCopy: { type: String },
    passportPhoto: { type: String },
    visaCopy: { type: String },
    localAddressProof: { type: String },
  },
});

const customerSchema = new mongoose.Schema(
  {
    assignedAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },

    // ✍️ Agent/Manager-Filled Fields (During creation)
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
    businessActivity1: { type: String }, // Main activity
    officeType: { type: String },

    quotedPrice: { type: Number },
    paymentPlans: [{ type: String }],
    paymentDetails: { type: String },

    // 📝 Customer-Filled Fields (Post onboarding)
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
