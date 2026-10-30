import bcrypt from "bcrypt";
import Employee from "../models/Employee.js";

const normalizeEmail = (value) => (typeof value === "string" ? value.toLowerCase().trim() : "");

const sanitizeEmployee = (employee) => {
  if (!employee) {
    return null;
  }

  const employeeObject = employee.toObject ? employee.toObject() : employee;
  const { password, ...safeEmployee } = employeeObject;
  return safeEmployee;
};

export const signupEmployee = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const normalizedEmail = normalizeEmail(email);

    if (
      trimmedName.length < 2 ||
      trimmedName.length > 80 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        error: "Provide a valid name, email, and password between 8 and 128 characters.",
      });
    }

    const existingEmployee = await Employee.findOne({ email: normalizedEmail });
    if (existingEmployee) {
      return res.status(400).json({ error: "Employee with this email already exists" });
    }

    const employee = new Employee({
      name: trimmedName,
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
    });

    await employee.save();

    res.status(201).json(sanitizeEmployee(employee));
  } catch (error) {
    console.error("Error adding employee:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().select("-password");
    res.json(employees);
  } catch (error) {
    console.error("Error displaying employees:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;
    const update = {};

    if (typeof name === "string") {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ error: "Name cannot be empty." });
      }
      update.name = trimmedName;
    }

    if (typeof email === "string") {
      const normalizedEmail = normalizeEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: "Provide a valid email address." });
      }

      const duplicateEmployee = await Employee.findOne({ email: normalizedEmail, _id: { $ne: id } });
      if (duplicateEmployee) {
        return res.status(400).json({ error: "Employee with this email already exists" });
      }

      update.email = normalizedEmail;
    }

    if (typeof password === "string") {
      if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ error: "Password must be between 8 and 128 characters." });
      }
      update.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "No valid employee fields supplied." });
    }

    const employee = await Employee.findByIdAndUpdate(id, update, { new: true }).select("-password");

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json(employee);
  } catch (error) {
    console.error("Error updating employee:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findByIdAndDelete(id);

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
