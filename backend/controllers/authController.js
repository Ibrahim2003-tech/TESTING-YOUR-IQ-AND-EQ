import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "8h";
const cookieOptions = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 8 * 60 * 60 * 1000,
};

const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const seedAdminUser = async () => {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail && !adminPassword) {
    return;
  }

  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error("Set both ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters to seed an admin.");
  }

  const existingUser = await User.findOne({ email: adminEmail });
  if (existingUser) {
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await User.create({
    name: "System Admin",
    email: adminEmail,
    password: hashedPassword,
    role: "admin",
  });

  console.log("Configured admin user created");
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user);

    res.cookie("token", token, cookieOptions);

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    return res.json({
      message: "Login successful",
      user: safeUser,
      csrfToken: req.csrfToken ? req.csrfToken() : "",
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
};

export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 80 ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    return res.status(400).json({
      message: "Provide a name, valid email, and password between 8 and 128 characters.",
    });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "student",
    });

    return res.status(201).json({ message: "Student account created. You can now sign in." });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    console.error("Registration failed:", error);
    return res.status(500).json({ message: "Unable to create account." });
  }
};

export const logoutUser = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res.json({ message: "Logout successful" });
};

export const getCurrentUser = async (req, res) => {
  return res.json({ user: req.user });
};

export const getSession = async (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.json({ user: null });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    return res.json({ user: user || null });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.json({ user: null });
    }
    throw error;
  }
};

export const getSocketToken = async (req, res) => {
  const socketToken = jwt.sign(
    { id: req.user._id, purpose: "socket" },
    JWT_SECRET,
    { expiresIn: "1m" }
  );
  return res.json({ socketToken });
};

export { seedAdminUser };
