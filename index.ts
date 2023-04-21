import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { dbconnect } from './services/database';
import { accountRoute } from './routes/account';

dotenv.config();
dbconnect()
const port = process.env.PORT || 8000

const app: Express = express()
app.use(cors())
app.options('*', cors()) 
app.use(cookieParser(process.env.ACCESS_TOKEN_SECRET))

app.use(express.json({ limit: '200mb' }))
app.use(express.urlencoded({ extended: true, limit: '200mb' }))
app.use(accountRoute)
app.use('/', (req: Request, res: Response) => {
	res.send(req.protocol + '://' + req.hostname);
})

app.listen(port, () => {
	console.log(`[log] Server is running at http://localhost:${port}`)
});
