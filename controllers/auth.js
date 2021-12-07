const User = require('../models/user');
const MongoError = require('../util/mongoError');
const messages = require('../messages/messages');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const OneTimeToken = require('../models/oneTimeToken');
const throwError = require('../util/throwError');

exports.login = async (req, res, next) => {
    const { password, username } = req.body;

    try {
        const findedUser = await User.findOne({ username: username, isActivated: true });
        if (!findedUser) {
            throwError({
                message: messages.user.invalidData
            })
        }

        const isPasswordValid = await bcrypt.compare(password, findedUser.password);
        if (!isPasswordValid) {
            throwError({
                message: messages.user.invalidData
            })
        }

        const payload = {
            id: findedUser._id,
        }
        const accessToken = jwt.sign(payload, config.ACCESS_TOKEN, {
            expiresIn: config.ACCESS_TOKEN_EXPIRES_IN_SECONDS
        });
        const refreshToken = jwt.sign(payload, config.REFRESH_TOKEN, {
            expiresIn: config.REFRESH_TOKEN_EXPIRES_IN_MILISECONDS
        });

        res.send({
            accessToken: accessToken,
            refreshToken: refreshToken,
            accessTokenExpiresIn: config.ACCESS_TOKEN_EXPIRES_IN_SECONDS * 1000,
            refreshTokenExpiresIn: config.REFRESH_TOKEN_EXPIRES_IN_MILISECONDS
        });
    } catch (err) {
        next(err)
    }
}

exports.signup = async (req, res, next) => {
    const { username, password, email } = req.body;

    try {
        const newUser = new User({
            username: username,
            password: password,
            email: email,
            isActivated: false
        });

        await newUser.validate();
        newUser.password = await bcrypt.hash(password, config.HASHED_PASSWORD_LENGTH);

        const createdUser = await newUser.save({ validateBeforeSave: false });
        const newOneTimeToken = new OneTimeToken({ creator: createdUser._id });
        const createdOneTimeToken = await newOneTimeToken.save();

        createdOneTimeToken.sendEmailWithToken('activation');
        res.status(201).send({ message: messages.oneTimeToken.newTokenHasBeenCreated });
    } catch (err) {
        const mongoError = new MongoError(err)
        const message = mongoError.getMessage();

        const isValidationError = mongoError.isValidationError();
        const isDuplicateError = mongoError.isDuplicateError();

        if (isValidationError || isDuplicateError) {
            err.statusCode = isDuplicateError ? 409 : 400;
            err.errorMessage = message || messages.global.invalidData;
        }

        next(err);
    }
}


exports.activate = async (req, res, next) => {
    const { token } = req.params;
    try {
        const findedOneTimeToken = await OneTimeToken.findOne({ 'activation.token': token });
        if (!findedOneTimeToken) {
            throwError({
                message: messages.oneTimeToken.invalidData
            })
        }

        const oneTimeTokenHasExpired = findedOneTimeToken.hasTokenExpired('activation');
        if (oneTimeTokenHasExpired) {
            const updatedOneTimeToken = await findedOneTimeToken.makeValid();
            updatedOneTimeToken.sendEmailWithToken('activation');
            res.send({ message: messages.oneTimeToken.newTokenHasBeenGenerated })
        }

        if (!oneTimeTokenHasExpired) {
            await User.updateOne({ _id: findedOneTimeToken.creator }, {
                $set: {
                    isActivated: true,
                }
            })
            res.send({ message: messages.oneTimeToken.tokenHasBeenUsedSuccessfully });
        }
    } catch (err) {
        next(err)
    }
}

exports.getStatus = async (req, res, next) => {
    const userId = req.userData.id;
    console.log(userId)
    try {
        const user = await User.findOne({ _id: userId });
        if (!user) {
            throwError()
        }

        res.send({
            username: user.username,
            email: user.email
        })
    } catch (err) {
        const mongoError = new MongoError(err);
        const isValidationError = mongoError.isValidationError();
        if (isValidationError) {
            err.statusCode = 400;
        }
        next(err);
    }
}