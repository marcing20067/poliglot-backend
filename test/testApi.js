const httpRequest = require('supertest');
const User = require('../models/user');

const validUser = {
    username: 'admin',
    password: 'password',
    email: 'email@mail.pl'
}

const newUser = {
    username: 'newUsername',
    password: 'newPassword',
    email: 'email1@mail.pl'
}

const validSet = {
    name: 'name',
    cards: [
        {
            concept: 'concept',
            definition: 'definition',
            group: 1
        }
    ],
    stats: {
        group1: 1,
        group2: 0,
        group3: 0,
        group4: 0,
        group5: 0
    },
    creator: 'creator'
}

const responseStatusShouldBe = (response, status) => {
    expect(response.status).toBe(status);
}

const responseTypeShouldContainJson = (response) => {
    const contentType = response.headers['content-type'];
    expect(/json/.test(contentType))
}

const responseBodyShouldContainProperty = (response, property) => {
    expect(response.body).toHaveProperty(property);
}

const messageShouldBe = (response, correctMessage) => {
    const message = response.body.message;
    expect(message).toBe(correctMessage);
}

const makeHttpRequest = async (app, options) => {
    const { method, endpoint, customCookie, isIncludeToken, data, customToken } = options;
    const lowercaseMethod = options.method.toLowerCase();

    let request = httpRequest(app)[lowercaseMethod](endpoint);

    if (method === 'POST' || method === 'PUT') {
        request = request.send(data);
    }

    if (customCookie) {
        request = request.set('Cookie', customCookie)
    }

    if (isIncludeToken) {
        const authToken = customToken || await getToken(app);
        request = request.set('Authorization', 'Bearer ' + authToken);
    }

    return request;
}

let token;

const getToken = async (app) => {
    if (!token) {
        const response = await makeHttpRequest(app, {
            method: 'POST',
            endpoint: '/login',
            data: validUser
        });
        token = response.body.accessToken
    }
    return token;
}

let isUserCreated = false;
const tryCreateValidUser = async () => {
    if (!isUserCreated) {
        try {
            const user = new User({ ...validUser, isActivated: true });
            await user.save();
        } catch {
            // User already exists.
        } finally {
            isUserCreated = true;
        }
    }
}

module.exports = {
    newUser,
    validUser,
    validSet,
    responseStatusShouldBe,
    responseTypeShouldContainJson,
    responseBodyShouldContainProperty,
    messageShouldBe,
    makeHttpRequest,
    getToken,
    tryCreateValidUser,
}