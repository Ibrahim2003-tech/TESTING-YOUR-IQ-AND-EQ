import express from "express";
import {
  signupEmployee,
  getEmployees,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employeeController.js";

const router = express.Router();

router.post("/signup", signupEmployee);
router.get("/view", getEmployees);
router.put("/update/:id", updateEmployee);
router.delete("/delete/:id", deleteEmployee);

export default router;
