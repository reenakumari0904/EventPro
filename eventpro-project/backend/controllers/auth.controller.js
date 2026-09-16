import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { query } from "../config/db.js";

// POST /register (user account, not event registration)
export async function signup(req, res) {
  try {
    const { name, email, phone, organization, city, country, gender, age, interest } = req.body;
    let { password } = req.body;

    if (!password) {
      password = crypto.randomBytes(12).toString("hex");
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, phone, organization, city, country, gender, age, interest)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING user_id, name, email, role`,
      [name, email, password_hash, phone, organization, city, country, gender || null, age || null, interest || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function adminSignup(req, res) {
  try {
    const { name, email, password, invite_code } = req.body;

    if (!invite_code || invite_code !== process.env.ADMIN_SIGNUP_CODE) {
      return res.status(403).json({ error: "Invalid invite code." });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING user_id, name, email, role`,
      [name, email, password_hash]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") { 
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    console.error("POST /admin/register error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

export async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;
    const result = await query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (user.role !== "admin") {
      return res.status(403).json({ error: "This account doesn't have admin access." });
    }

    const token = jwt.sign({ user_id: user.user_id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, user: { user_id: user.user_id, name: user.name, role: user.role } });
  } catch (err) {
    console.error("POST /admin/login error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const result = await query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ user_id: user.user_id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, user: { user_id: user.user_id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}