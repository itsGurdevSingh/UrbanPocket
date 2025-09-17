import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    zipCode: { type: String, trim: true }
});

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true, trim: true, index: true },
    password: { type: String, minlength: 8, select: false },
    personalInfo: {
        fullName: {
            firstname: { type: String, trim: true },
            lastname: { type: String, trim: true }
        },
        dateOfBirth: { type: Date },
    },
    contactInfo: {
        email: { type: String, unique: true, required: true, trim: true, lowercase: true, index: true },
        contactNumber: [{ type: String, trim: true }],
    },
    role: { type: String, default: "user", enum: ["user", "seller", "admin"] },
    verified: { type: Boolean, default: false },
    addresses: [addressSchema],
    profileImage: { type: String, default: null },

}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;