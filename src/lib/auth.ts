import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export const generateToken = (user: any) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role.name,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: "1d" }
  );
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};
