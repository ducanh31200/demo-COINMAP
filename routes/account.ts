import express from 'express';
import * as Account from '../controller/accountController';

const route = express.Router();


// field: code, email_or_phone, password, name, birth, gender, address
// type: 
//      code**: string
//      email_or_phone**: string
//      password**: string
//      name: string 
//      birth: Date
//      gender: boolean
//      address: object - {province: string, district: string, address: string}
route.post('/account/signUp', Account.PhoneFormatter, Account.OTPCheck, Account.SignUp)

// field: email_or_phone, email, phone
// type: 
//      email_or_phone: string
//      email: string
//      phone: string
// rule: email_or_phone | email | phone
route.post('/account/otp', Account.PhoneFormatter, Account.OTPRequest)
route.get('/test', Account.Test)

// field: email_or_phone, password, code, googleToken
// type: 
//      email_or_phone: string
//      password: string
//      code: string
//      googleToken: string
// rule: (email_or_phone & password) | (email_or_phone & code) | googleToken
route.post('/account/login', Account.PhoneFormatter, Account.SignIn)


// header: accessToken - role: All - field: name, birth, gender, address
// type: 
//      name**: string
//      birth**: Date
//      gender**: boolean
//      address**: string

export const accountRoute = route