'use strict'
//Import dependencies
const mongoose = require('mongoose');
const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const jwt = require('jsonwebtoken');

//Import modules
const { Strain, User } = require('../models');
const { app, runServer, closeServer } = require('../server');
const { JWT_SECRET, TEST_DATABASE_URL } = require('../config');

//Enable expect style syntax
const expect = chai.expect;

//Enable use of chai-http testing methods
chai.use(chaiHttp);

//Delete entire DB
function tearDownDb() {
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}

describe('Auth endpoints', function() {
    const userName = 'exampleUser'
    const password = 'examplePassword';
    const firstName = 'Babe';
    const lastName = 'Ruth';

    before(function() {
        return runServer(TEST_DATABASE_URL);
    });

    beforeEach(function() {
        return User.hashPassword(password).then(function(password) {
            return User.create({
                userName,
                password,
                firstName,
                lastName
            })
        });
    });

    afterEach(function() {
        return tearDownDb();
    })

    after(function() {
        return closeServer();
    });

    describe('/auth/login', function() {
        
        it('Should reject request with no credentials', function() {
            return chai.request(app).post('/auth/login').send({}).then(function(res) {
                expect(res).to.have.status(400);
            }).catch(function(err) {
                if (err instanceof chai.AssertionError) {
                    throw err;
                }
            });
        });

        it('Should reject request with incorrect usernames', function() {
            return chai.request(app).post('/auth/login').send({ userName: 'wrongUsername', password }).then(function(res) {
                expect(res).to.have.status(401);
            }).catch(function(err) {
                if (err instanceof chai.AssertionError) {
                    throw err;
                }
            });
        });

        it('Should reject request with incorrect passwords', function() {
            return chai.request(app).post('/auth/login').send({ userName, password: 'wrongPassword' }).then(function(res) {
                expect(res).to.have.status(401);
            }).catch(function(err) {
                if (err instanceof chai.AssertionError) {
                    throw err;
                }
            });
        });

        it('Should return a valid auth token', function() {
            return chai.request(app).post('/auth/login').send({ userName, password }).then(function(res) {
                expect(res).to.have.status(200);
                expect(res.body).to.be.a('object');
                const token = res.body.authToken;
                expect(token).to.be.a('string');
                const payload = jwt.verify(token, JWT_SECRET, {
                    algorithm: ['HS256']
                });
            }).catch(function(err) {
                if (err instanceof chai.AssertionError) {
                    throw err;
                }
            });
        });     
    });

    describe('auth/refresh', function() {

        it('Should reject request with no credentials', function() {
            return chai.request(app).post('/auth/refresh').send({}).then(function(res) {
                expect(res).to.have.status(401);
            }).catch(function(err) {
                if (err instanceof chai.AssertionError) {
                    throw err;
                }
            });
        });

        it('Should reject requests with an invalid token', function() {
            const token = jwt.sign(
                {
                    user: {
                        userName,
                        firstName,
                        lastName
                    }
                },
                'wrongSecret',
                {
                    algorithm: 'HS256',
                    expiresIn: '7d'
                }
            );

            return chai.request(app).post('/auth/refresh').set('authorization', `Bearer ${token}`).then(function(res) {
                expect(res).to.have.status(401);
            }).catch(function(err) {
                if (err instanceof chai.AssertionError) {
                    throw err;
                }
            })
        });

        it('Should reject requests with an expired token', function() {
            const token = jwt.sign(
                {
                    user: {
                        userName,
                        firstName,
                        lastName  
                    },
                    exp: Math.floor(Date.now() / 1000) - 10
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: userName,
                }
            );

            return chai.request(app).post('/auth/refresh').set('authorization', `Bearer ${token}`).then(function(res) {
                expect(res).to.have.status(401);
            }).catch(function(err) {
                if (err instanceof chai.AssertionError) {
                    throw err;
                }
            });
        });

        it('Should return a valid auth token with a new expiry date', function() {
            const token = jwt.sign(
                {
                    user: {
                        userName,
                        firstName,
                        lastName
                    }
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: userName,
                    expiresIn: '7d'
                }
            );
            const decoded = jwt.decode(token);

            return chai.request(app).post('/auth/refresh').set('authorization', `Bearer ${token}`).then(function(res) {
                expect(res).to.have.status(200);
                expect(res.body).to.be.a('object');
                const token = req.body.authToken;
                expect(token).to.be.a('string');
                const payload = jwt.verify(token, JWT_SECRET, {
                    algorithm: ['HS256']
                });
                expect(payload.exp).to.be.at.least(decoded.exp);
            }).catch(function(err) {
                if (err instanceof chai.AssertionError) {
                    throw err;
                }
            });
        });

    });


});