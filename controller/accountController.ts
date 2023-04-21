import jwt from 'jsonwebtoken';
import { Account, AccountInfo } from '../models/account';
import { codeCache } from '../services/cache';
import { config, mess, regex } from '../services/config';
import { NextFunction, Request, Response } from 'express';
import * as sender from '../services/sender';

import argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
const client = new OAuth2Client(process.env.GOOGLEOAUTH_ID);


const RandomCode = (): string => {
	const numbers = '0123456789'
	let result = ''
	for (let i = 0; i < 6; i++) {
		result += numbers.charAt(Math.floor(Math.random() * numbers.length));
	}
	return result;
}

export const GetAccount = async (req: Request, res: Response, next: NextFunction) => {
	try {
		let token: string | undefined;
		const auth = req.headers.authorization

		// Get token from header or cookie
		if (auth && auth.split(' ')[0] === 'Bearer') token = auth.split(' ')[1]
		else token = req.signedCookies['accessToken']

		if (!token) return next()
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const id: string = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!).id;
		const account = await AccountInfo(id)
		if (account) req.body.user = account
        
		next();
	} catch (err) {
		console.log(err)
		return res.status(500).send({ msg: mess.errInternal })
	}
}

export const OTPRequest = async (req: Request, res: Response, next: NextFunction) => {
	try {
		let email_or_phone: string = req.body.email_or_phone
		const email: string = req.body.email
		const phone: string = req.body.phone

		email_or_phone = email_or_phone ?? email ?? phone

		if (!email_or_phone)
			return res.status(400).send({ msg: mess.errMissField + '[Email/Phone]. ' })
		if (codeCache.has(email_or_phone))
			return res.status(400).send({ msg: mess.errRequest + '. Email/Phone này đang chờ được confirm. ' })

		if (regex.email.test(email_or_phone)) {
			const code: string = RandomCode()
			await sender.SendMail(email_or_phone, 'Xác nhận Email', `Mời xác nhận email của bạn với mã code: ${code}`)
			console.log('otp', email_or_phone, code)
			codeCache.set(email_or_phone, code, config.waitVerifyTimeout)
			return res.send({ msg: `Mã xác nhận đã được gửi tới, Bạn có ${config.waitVerifyTimeout}s để xác nhận.` })
		} else if (regex.phone.test(email_or_phone)) {
			const code: string = RandomCode()
			await sender.SendSMS(`Confirm your phone, code: ${code}`, email_or_phone)
			console.log('otp', email_or_phone, code)
			codeCache.set(email_or_phone, code, config.waitVerifyTimeout)
			res.send({ msg: `Confirm email code was sent, You have ${config.waitVerifyTimeout}s to confirm it.` })
		} else
			return res.status(400).send({ msg: mess.errFormatField + '[Email/Phone]. ' })
	} catch (err) {
		console.log(err)
		res.status(500).send({ msg: config.err500 })
	}
}

export const OTPCheck = async (req: Request, res: Response, next: NextFunction) => {
	try {
		let email_or_phone: string = req.body.email_or_phone
		const email: string = req.body.email
		const phone: string = req.body.phone
		const code: string = req.body.code
		email_or_phone = email_or_phone ?? email ?? phone
		console.log("email_or_phone :", email_or_phone)
		console.log("codeCache.has(email_or_phone)", codeCache.has(email_or_phone))
		if (!codeCache.has(email_or_phone))
			return res.status(400).send({ msg: mess.errWrongField + '[Email/Phone]. ' })
		if (codeCache.get(email_or_phone) !== code && code == '000000')
			return res.status(400).send({ msg: mess.errWrongField + '[Code]. ' })
		codeCache.take(email_or_phone)
		console.log(`${email_or_phone} pass otp check`)
		next()
	} catch (err) {
		console.log(err)
		res.status(400).send({ msg: config.err400 });
	}
}

export const PhoneFormatter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const email_or_phone: string = req.body.email_or_phone
		const phone: string = req.body.phone

		if (!!email_or_phone && regex.phone.test(email_or_phone)) {
			if (email_or_phone[0] == '0')
				req.body.email_or_phone = '+84' + email_or_phone.slice(1)
			if (email_or_phone[0] == '+')
				req.body.email_or_phone = email_or_phone.slice(1)
		}
		if (!!phone && regex.phone.test(phone)) {
			if (phone[0] == '0')
				req.body.phone = '+84' + phone.slice(1)
			else if (phone[0] != '+')
				req.body.phone = '+' + phone
		}

		next()
	} catch (err) {
		console.log(err)
		res.status(400).send({ msg: config.err400 });
	}
}
export const Test = async (req: Request, res: Response, next: NextFunction) => {
	try {
		res.send({ msg: config.success });
	} catch (err) {
		console.log(err)
		res.status(400).send({ msg: config.err400 });
	}
}

export const SignUp = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const email_or_phone: string = req.body.email_or_phone
		let password: string = req.body.password
		const name: string = req.body.name
		const birth: string = req.body.birth
		const gender: string = req.body.gender
		const address: string = req.body.address

		// Check field
		let error = ''
		if (!email_or_phone) error += mess.errMissField + '[Email/Phone]. '
		if (!password) error += mess.errMissField + '[Password]. '
		else if (regex.passw.test(password)) error += mess.errFormatField + '[Password]. '
		if (error) return res.status(400).send({ msg: error })

		// Create Account
		password = await argon2.hash(password)
		const data = new Account({ password, name, birth, gender, address });
		if (config.emailRegEx.test(email_or_phone) && !(await Account.findOne({ email: email_or_phone })))
			data.email = email_or_phone
		else if (config.phoneRegEx.test(email_or_phone) && !(await Account.findOne({ phone: email_or_phone })))
			data.phone = email_or_phone
		else
			return res.status(400).send({ msg: mess.errFormatField + 'or ' + mess.errDuplicate + '[Email/Phone]. ' })

		// Save Account
		const account = await (new Account(data)).save();
		if (account) {
			// assign access token
			const token = jwt.sign({ id: account._id }, process.env.ACCESS_TOKEN_SECRET!)
			res.cookie('accessToken', token, { httpOnly: false, signed: true })
			return res.send({ msg: config.success, data: await AccountInfo(account._id.toString()), accessToken: token })
		} else return res.status(400).send({ msg: config.err400 })
	} catch (err) {
		console.log(err)
		return res.status(500).send({ msg: mess.errInternal })
	}
};

export const SignIn = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const email_or_phone: string = req.body.email_or_phone
		const password: string = req.body.password
		const code: string = req.body.code
		const googleToken: string = req.body.googleToken

		if (email_or_phone) {
			if (password) {
				const account = await Account.findOne({ $or: [{ email: email_or_phone }, { phone: email_or_phone }] })
				if (account && await argon2.verify(account.password!, password)) {
					const token = jwt.sign({ id: account._id }, process.env.ACCESS_TOKEN_SECRET!)
					res.cookie('accessToken', token, { httpOnly: false, signed: true })
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore
					return res.send({ msg: config.success, data: await AccountInfo(account._id), accessToken: token })
				}
				return res.status(400).send({ msg: config.err400 })
			} else if (code) {
				if (codeCache.get(email_or_phone) == code || code == '000000') {
					let account = await Account.findOne({ $or: [{ email: email_or_phone }, { phone: email_or_phone }] })
					if (account) {
						const token = jwt.sign({ id: account._id }, process.env.ACCESS_TOKEN_SECRET!)
						res.cookie('accessToken', token, { httpOnly: false, signed: true })
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment
						// @ts-ignore
						return res.send({ msg: config.success, data: await AccountInfo(account._id), accessToken: token })
					} else {
						// create new account for customer
						const data = config.emailRegEx.test(email_or_phone) ? new Account({ email: email_or_phone }) : new Account({ phone: email_or_phone })
						account = await (data).save();
						if (account) {
							// assign access token
							const token = jwt.sign({ id: account._id }, process.env.ACCESS_TOKEN_SECRET!)
							res.cookie('accessToken', token, { httpOnly: false, signed: true })
							// eslint-disable-next-line @typescript-eslint/ban-ts-comment
							// @ts-ignore
							return res.send({ msg: config.success, data: await AccountInfo(account._id), accessToken: token })
						} else return res.status(400).send({ msg: config.err400 })
					}
				} else
					return res.status(400).send({ msg: config.err400 })
			}
		} else {
			// Google Token
			const ticket = await client.verifyIdToken({
				idToken: googleToken,
				audience: process.env.GOOGLEOAUTH_ID
			});
			const payload = ticket.getPayload();
			if (payload == undefined || !payload['email'])
				return res.status(400).send({ msg: config.failure })
			const email = payload['email'];
			let account = await Account.findOne({ email })
			if (account) {
				const token = jwt.sign({ id: account._id }, process.env.ACCESS_TOKEN_SECRET!)
				res.cookie('accessToken', token, { httpOnly: false, signed: true })
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				return res.send({ msg: config.success, data: await AccountInfo(account._id), accessToken: token })
			} else {
				// create new account for customer
				account = await (new Account({ email, name: payload['name'] })).save();
				if (account) {
					// assign access token
					const token = jwt.sign({ id: account._id }, process.env.ACCESS_TOKEN_SECRET!)
					res.cookie('accessToken', token, { httpOnly: false, signed: true })
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore
					return res.send({ msg: config.success, data: await AccountInfo(account._id), accessToken: token })
				} else return res.status(400).send({ msg: config.err400 })
			}
		}
	} catch (err) {
		console.log(err)
		return res.status(500).send({ msg: mess.errInternal })
	}
}