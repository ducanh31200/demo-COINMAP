import { Schema, model, Types } from 'mongoose';
import { config } from '../services/config';

export interface IAddress {
    province: string, 
    district: string,
    address: string
}





export interface IAccount {
    _id: Types.ObjectId,
    // Login Info 
    email: string, // ** need exist: email || phone
    phone: string,
    password: string,

    // Information
    name: string,
    birth: Date,
    gender: string,
    address: IAddress,

    // Features
    enable: boolean,

    // Timestamps
    createdAt: Date,
    updatedAt: Date
}

// phone & email need to check unique in application level
export const accountSchema = new Schema<IAccount>({
	// Login Info 
	email: {
		type: String,
		required: function () {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			//@ts-ignore
			return this.phone === undefined;
		},
		validate: {
			validator: function (v: string) {
				return config.emailRegEx.test(v)
			},
			message: 'Email format is not correct.'
		},
		trim: true
	},
	password: {
		type: String,
		trim: true
	},
	phone: {
		type: String,
		required: function () {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			//@ts-ignore
			return this.email === undefined;
		},
		validate: {
			validator: function (v: string) {
				return config.phoneRegEx.test(v)
			},
			message: 'Phone format is not correct.'
		},
		trim: true
	},

	// Information
	name: String,
	birth: Date,
	gender: String,
	address: {
		province: String,
		district: String,
		address: String
	},


	enable: {type: Boolean, default: true}
}, { timestamps: true })


export const AccountInfo = async (_id: string) => await Account.findById(_id)



export const Account = model<IAccount>('Account', accountSchema)
