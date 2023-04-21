import mongoose from 'mongoose';


export const dbconnect = async () => {
	try {
		mongoose.set("strictQuery", false);
		await mongoose.connect(process.env.MONGODB_CONNECT_STR!);
		console.log('[log] database connected')
	} catch (error) {
		console.log(`[err] ${error}`)
		process.exit(1)
	}
}