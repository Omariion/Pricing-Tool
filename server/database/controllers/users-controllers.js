const UserModel = require("../models/user");
const { v4: uuidv4 } = require("uuid");
const { validationResult } = require("express-validator");
const HttpError = require("../models/http-error");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await UserModel.find({}, "-password");
  } catch (err) {
    const error = new HttpError(
      "Fetching users failed, please try again later.",
      500
    );
    return next(error);
  }
  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const userRegister = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data", 422)
    );
  }
  const { firstName, lastName, email, phone, password } = req.body;

  let existingUser;
  try {
    existingUser = await UserModel.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      "Signing up failed, please try again later.",
      500
    );
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError(
      "User exists already, please login instead.",
      422
    );
    return next(error);
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError(
      "Could not create user, please try again.",
      500
    );
    return next(error);
  }

  const createdUser = new UserModel({
    userId: uuidv4(),
    firstName,
    lastName,
    email,
    phone,
    password: hashedPassword,
    role: "Client", //"Client, Counselor, Admin"
  });

  try {
    await createdUser.save();
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again.", 500);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      "supersecret_dont_share",
      { expiresIn: "1h" } //login expires in 1hour
    );
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again.", 500);
    return next(error);
  }

  res.status(201).json({
    userId: createdUser.id,
    email: createdUser.email,
    token: token,
    role: createdUser.role,
  });
};

const userLogin = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;

  try {
    existingUser = await UserModel.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      "Logging in failed, please try again later.",
      500
    );
    return next(error);
  }

  if (!existingUser) {
    const error = new HttpError(
      "Invalid credentials, could not log you in.",
      401
    );
    return next(error);
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError(
      "Invalid username or password entered, please try again",
      500
    );
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError(
      "Invalid username or password entered, please try again",
      401
    );
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
      "supersecret_dont_share",
      { expiresIn: "1h" } //login expires in 1hour
    );
  } catch (err) {
    const error = new HttpError("Logining in failed, please try again.", 500);
    return next(error);
  }

  res.json({
    userId: existingUser.id,
    email: existingUser.email,
    token: token,
    role: existingUser.role,
  });
};

const userRoleChange = async (req, res, next) => {
  const role = req.params.role;
  const email = req.params.emailKey;
  let existingUser;

  try {
    existingUser = await UserModel.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      "Cannot find user, lease try again later.",
      500
    );
    return next(error);
  }
  console.log(existingUser);
  existingUser.role = role;
  console.log(existingUser);
  try {
    // existingUser.role = role;
    await existingUser.save();
  } catch (err) {
    // const error = new HttpError("Update failed, please try again.", 500);
    return next(err);
  }

  console.log(existingUser);

  // let isValidPassword = false;
  // try {
  //   isValidPassword = await bcrypt.compare(password, existingUser.password);
  // } catch (err) {
  //   const error = new HttpError(
  //     "Invalid username or password entered, please try again",
  //     500
  //   );
  //   return next(error);
  // }

  res.json({
    userId: existingUser.id,
    email: existingUser.email,
    role: existingUser.role,
  });
};

const userDeleteByEmail = async (req, res, next) => {
  const email = req.params.emailKey;
  let existingUser;

  try {
    existingUser = await UserModel.deleteOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      "Cannot find user, lease try again later.",
      500
    );
    return next(error);
  }
};

const searchByEmail = async (req, res, next) => {
  const email = req.params.emailKey;
  let existingUser;

  try {
    existingUser = await UserModel.findOne({ email: email });
    if (existingUser == null) {
      throw "";
    }
  } catch (err) {
    const error = new HttpError(
      "Cannot find user, lease try again later.",
      500
    );
    return next(error);
  }
  // console.log(existingUser);
  res.status(200).json({
    existingUser,
  });
};

const updateUserByEmail = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data", 422)
    );
  }

  const email = req.params.emailKey;

  const { firstName, lastName, phone, password } = req.body;

  let existingUser;

  if (password == null) {
    try {
      existingUser = await UserModel.updateOne(
        { email: email },
        {
          $set: {
            firstName: firstName,
            lastName: lastName,
            phone: phone,
          },
        }
      );
    } catch (err) {
      const error = new HttpError(
        "Cannot find user, lease try again later.",
        500
      );
      return next(error);
    }
  } else {
    let hashedPassword;

    try {
      hashedPassword = await bcrypt.hash(password, 12);
    } catch (err) {
      const error = new HttpError(
        "Could not create user, please try again.",
        500
      );
      return next(error);
    }

    try {
      existingUser = await UserModel.updateOne(
        { email: email },
        {
          $set: {
            password: hashedPassword,
          },
        }
      );
    } catch (err) {
      const error = new HttpError(
        "Cannot find user, lease try again later.",
        500
      );
      return next(error);
    }
  }
  res.status(201).json({
    userId: existingUser.id,
    email: existingUser.email,
    role: existingUser.role,
  });
};

const forgotPassword = async (req, res, next) => {
  const email = req.params.emailKey;
  let existingUser;

  try {
    existingUser = await UserModel.findOne({ email: email });
    if (existingUser == null) {
      throw "";
    }

    const resetId = uuidv4();
    existingUser.resetId = resetId;

    const resetLink = `http://localhost:3000/resetPassword/${resetId}/${email}`;

    sendEmail(email, resetLink).catch(console.error);
  } catch (err) {
    const error = new HttpError(
      "Cannot find user, lease try again later.",
      500
    );
    return next(error);
  }

  try {
    await existingUser.save();
  } catch (err) {
    const error = new HttpError("Reset error, please try again.", 500);
    return next(error);
  }
};

const resetPassword = async (req, res, next) => {
  const email = req.params.emailKey;
  const resetId = req.params.resetKey;
  const { formPW } = req.body;
  let existingUser;

  try {
    existingUser = await UserModel.findOne({ email: email });
    if (existingUser.resetId != resetId) {
      console.log("hello");
      throw "Cannot find user, lease try again later.";
    }
  } catch (err) {
    const error = new HttpError(
      "Cannot find user, lease try again later.",
      500
    );
    return next(error);
  }

  let hashedPassword;

  try {
    hashedPassword = await bcrypt.hash(formPW, 12);
  } catch (err) {
    const error = new HttpError(
      "Could not create password, please try again.",
      500
    );
    return next(error);
  }

  try {
    existingUser = await UserModel.updateOne(
      { email: email },
      {
        $set: {
          password: hashedPassword,
        },
      }
    );
  } catch (err) {
    const error = new HttpError(
      "Cannot find user, lease try again later.",
      500
    );
    return next(error);
  }

  res.status(201).json({
    userId: existingUser.id,
    email: existingUser.email,
    role: existingUser.role,
  });
};

const sendEmail = async (receiverEmail, resetLink) => {
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: "stadiaresidentevil9@gmail.com",
      pass: "ABCDE13579",
    },
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: '"Fred Foo 👻" <foo@example.com>', // sender address
    to: `${receiverEmail}`, // list of receivers
    subject: "Phare Password Reset", // Subject line
    text: resetLink, // plain text body
    html: `<b>${resetLink}</b>`, // html body
  });

  console.log("Message sent: %s", info.messageId);
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

  // Preview only available when sending through an Ethereal account
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
};

exports.getUsers = getUsers;
exports.userRegister = userRegister;
exports.userLogin = userLogin;
exports.userRoleChange = userRoleChange;
exports.userDeleteByEmail = userDeleteByEmail;
exports.searchByEmail = searchByEmail;
exports.updateUserByEmail = updateUserByEmail;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
