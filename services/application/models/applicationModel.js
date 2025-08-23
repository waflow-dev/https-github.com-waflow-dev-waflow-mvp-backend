import mongoose from "mongoose";

//  Step Schema (Retained)
const stepSchema = new mongoose.Schema({
  stepName: { type: String, required: true },
  status: {
    type: String,
    enum: [
      "Not Started",
      "Started",
      "Submitted for Review",
      "Awaiting Response",
      "Approved",
      "Declined",
      "Skipped",
      "Awaiting Client Response",
    ],
    default: "Not Started",
  },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    refPath: "addedByRole",
  },
  updatedByRole: {
    type: String,
    enum: ["customer", "agent", "admin"],
    required: false,
  },
  updatedByFullName: {
    type: String,
    required: false, // optional, but recommended so you always save it
  },
});

//  Notes schema (used by agents/managers)
const noteSchema = new mongoose.Schema({
  message: String,
  addedByFullName: {
    type: String,
    required: false, // optional, but recommended so you always save it
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "addedByRole",
  },
  addedByRole: {
    type: String,
    enum: ["customer", "agent", "admin"],
    required: true,
  },
  timestamp: { type: Date },
});

// Payment Entry schema (repeatable group)
const paymentEntrySchema = new mongoose.Schema({
  paymentMethod: String,
  amountPaid: Number,
  paymentDate: Date,
  transactionRefNo: String,
  paymentStatus: String,
  receiptUpload: String, // URL of file stored in Cloudinary or DB
  additionalNotes: String,
});

//  Nature of Control - Enum List
const natureOfControlEnum = [
  "Shareholder",
  "Voting Rights",
  "Right to Appoint or Remove Directors",
  "Control via Agreement or Arrangement",
  "Significant Influence or Control",
  "Beneficial Owner",
  "Trustee",
  "Other", // frontend will provide input if this is selected
];

// Sponsor Schema
const sponsorSchema = new mongoose.Schema({
  firstName: String,
  middleName: String,
  lastName: String,
  nationality: String,
  passportCopy: String, // file URL
  emiratesId: String, // file URL
  contactNumber: String,
  address: String,
  relationship: {
    type: String,
    enum: ["Individual", "Company", "Family", "Other"],
  },
});

// Shareholder Schema
const shareholderSchema = new mongoose.Schema({
  passportCopy: String,
  emiratesId: String,
  visaRequired: Boolean,
  visaType: { type: String, enum: ["Investor", "Employee"] },
  salary: Number,
  passportPhoto: String,
  nocLetter: String,
  homeCountryAddress: {
    line1: String,
    line2: String,
    state: String,
    country: String,
    zipcode: String,
  },
  uaeMobile: String,
  homeMobile: String,
  email: String,
  nationality: String,
  motherName: String,
  fatherName: String,
  sourceOfFunds: String,
  shareholderName: String,
  shareholderNationality: String,
  shareholderPassportCopy: String,
  ownershipPercentage: Number,
  designation: String,
  natureOfControl: [{ type: String, enum: natureOfControlEnum }],
  natureOfControlOtherText: { type: String },
});

const applicationSchema = new mongoose.Schema(
  {
    applicationId: { type: String, unique: true }, // Will be like "APP-0001"

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "New",
        "Waiting for Agent Review",
        "Ready for Processing",
        "In Progress",
        "Completed",
        "Rejected",
        "Awaiting Client Response",
      ],
      default: "New",
    },

    // Agent/Manager-filled fields
    applicationType: {
      type: String,
      enum: ["Mainland", "Freezone", "Offshore"],
    },
    emirate: {
      type: String,
      enum: [
        "Dubai",
        "Abu Dhabi",
        "Sharjah",
        "Ajman",
        "RAK",
        "Fujairah",
        "UAQ",
      ],
    },
    legalForm: {
      type: String,
      enum: [
        "LLC",
        "Sole Proprietorship",
        "Civil Company",
        "Branch",
        "Holding",
        "Freezone Company",
      ],
    },
    proposedCompanyNamesEN: { type: String, required: true },
    proposedCompanyNameAR: { type: String },
    jurisdiction: { type: String },
    officeRequired: { type: Boolean },
    officeType: {
      type: String,
      enum: [
        "Flexi Desk",
        "Smart Office",
        "Executive Office",
        "Virtual Office",
        "Warehouse",
        "Retail Shop / Showroom",
        "Business Centre Office",
        "Shared Office / Co-working Space",
      ],
    },

    totalAgreedCost: { type: Number },
    paymentEntries: [paymentEntrySchema],

    // 🧑‍💼 Customer-filled fields
    businessActivities: [{ type: String }], // multiselect or autocomplete
    numberOfShareholders: { type: Number },
    basicInvestment: { type: Number },

    sponsorRequired: { type: Boolean },
    sponsorDetails: [sponsorSchema],

    shareholderDetails: [shareholderSchema],

    // 📝 Internal
    steps: [stepSchema],
    notes: [noteSchema],
    isLocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Application", applicationSchema);
