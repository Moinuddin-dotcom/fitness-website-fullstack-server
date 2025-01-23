const express = require('express')
const app = express();
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 8002

// middleware
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.afwrd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const database = client.db('gymDB')
        const userCollection = database.collection('users')
        const subscriberCollection = database.collection('subscribers')
        const bookedTrainerCollection = database.collection('bookedTrainers')
        const classCollection = database.collection('classes')

        // jwt token for authorization (localStorage)
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "365d" })
            res.send({ token });
        })

        // jwt middleware: verifyToken
        const verifyToken = (req, res, next) => {
            // console.log("Inside the verifyToken:", req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "Unauthorized access" })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: "Unauthorized access" })
                }
                req.decoded = decoded
                next()
            })
        }


        // save all logged in user in the database
        app.post('/users', async (req, res) => {
            const user = req.body
            const query = { email: user?.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) return res.send({ message: "User already exists", insertedId: null })
            const result = await userCollection.insertOne(user)
            res.send(result);
        })

        // get logged in user info from database
        app.get('/users', async (req, res) => {
            const user = await userCollection.find().toArray()
            res.send(user);
        })




        // updateing be a trainer data info in userCollection database for be a trainer application
        app.patch('/users-from/:email', verifyToken, async (req, res) => {
            const trainerInfo = req.body;
            const { email } = req.params
            const updateInfo = {
                $set: {
                    ...trainerInfo,
                },
            }
            const result = await userCollection.updateOne({ email: email }, updateInfo)
            res.send(result)
        })

        // get user role by email
        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email
            // console.log(email)
            const query = { email }
            const result = await userCollection.findOne(query)
            // console.log(result)
            res.send({ role: result?.role });
        })




        // get applied-trainers from database and show all data without admin data
        app.get('/users/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { email: { $ne: email } } // ($ne:) means not equal to
            const withOutAdminEmail = await userCollection.find(query).toArray()
            res.send(withOutAdminEmail);
        })

        // admin section: get applied trainer details
        app.get('/users-details/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const trainer = await userCollection.findOne(query)
            res.send(trainer);
        })


        // Update user role & status by admin(role: member to trainer & status: Pending to Approved)
        app.patch('/users-role-update/:email', verifyToken, async (req, res) => {
            const { role } = req.body
            const email = req.params.email
            const filter = { email }
            const updateRole = {
                $set: {
                    role,
                    status: 'Approved'
                },
            }
            const result = await userCollection.updateOne(filter, updateRole)
            res.send(result)
        })
        // Update trainer role & status by admin(role: trainer to member & status: Approved to "" )
        app.patch('/trainer-role-update/:email', verifyToken, async (req, res) => {
            const { role } = req.body
            const email = req.params.email
            // const filter = { emaildata: email }
            const filter = { email }
            const updateRole = {
                $set: {
                    role,
                    status: " "
                },
            }
            const result = await userCollection.updateOne(filter, updateRole)
            res.send(result)
        })


        // Update: applied user status & rejection by admin(rejection message & status: Pending to Reject)
        app.patch('/users-role-updateForReject/:email', verifyToken, async (req, res) => {
            const rejectInfo = req.body
            const { email } = req.params
            // const filter = { email }
            const updateRejectedUserRole = {
                $set: {
                    ...rejectInfo, status: 'Reject',
                },
            }
            const result = await userCollection.updateOne({ email: email }, updateRejectedUserRole)
            res.send(result)
        })

        // member section: get trainer data on All trainer section by ROLE
        app.get('/users/all-trainers/role', verifyToken, async (req, res) => {
            const { role } = req.query

            let query = {}
            if (role) {
                query.role = role
            }
            // console.log("Query:", query);
            const result = await userCollection.find(query).toArray()
            // console.log("Result:", result);
            res.send(result);
        })

        // member section: get applied trainer details
        app.get('/trainerDetails/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const trainer = await userCollection.findOne(query)
            res.send(trainer);
        })



        // get all users for add new slots
        app.get('/logedInUser', verifyToken, async (req, res) => {
            const userEmail = req.decoded.email
            // const { id } = req.params
            // const query = { _id: new ObjectId(id) }
            const query = { email: userEmail }
            const trainerData = await userCollection.findOne(query)
            res.send(trainerData);
        })





        // -----------------------------------------------------------------

        // booking trainer details in db
        app.post('/book-trainer', verifyToken, async (req, res) => {
            // const { trainerId, trainerDay } = req.body
            const trainerInfo = req.body
            // getting user email
            const userEmail = req.decoded.email
            // finding trainer by id
            const query = { _id: new ObjectId(trainerInfo.trainerId) }
            const trainer = await userCollection.findOne(query)

            // saving trainer details on new collection db
            const bookingDetails = {
                trainerId: new ObjectId(trainerInfo.trainerId),
                userEmail,
                trainerDay: trainerInfo.trainerDay,
                bookedAt: new Date(),
            }
            const result = await bookedTrainerCollection.insertOne(bookingDetails)
            res.send({ bookingId: result.insertedId })
        })



        // ____________________________________________________________________


        // save all classes in the database
        app.post('/classes', verifyToken, async (req, res) => {
            const classData = req.body
            const result = await classCollection.insertOne(classData)
            res.send(result)
        })

        // get all classes from the database
        app.get('/classes', verifyToken, async (req, res) => {
            const classes = await classCollection.find().toArray()
            res.send(classes);
        })








        //save all subscriber on database
        app.post('/subscribers', async (req, res) => {
            const subscriber = req.body
            const existingSubscriber = await subscriberCollection.findOne({ email: subscriber.email })
            if (existingSubscriber) return res.send({ message: "User already exists", insertedId: null })
            const result = await subscriberCollection.insertOne(subscriber)
            res.send(result);
        })




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Hello from Assingment 12 Server....')
})

app.listen(port, () => console.log(`Server running on port ${port}`))