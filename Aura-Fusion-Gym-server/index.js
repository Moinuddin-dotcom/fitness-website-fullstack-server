const express = require('express')
const app = express();
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
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
        const trainerCollection = database.collection('trainers')

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

        //save all subscriber on database
        app.post('/subscribers', async (req, res) => {
            const subscriber = req.body
            const existingSubscriber = await subscriberCollection.findOne({ email: subscriber.email })
            if (existingSubscriber) return res.send({ message: "User already exists", insertedId: null })
            const result = await subscriberCollection.insertOne(subscriber)
            res.send(result);
        })

        // post trainer request on database
        app.post('/trainers', async (req, res) => {
            const trainer = req.body
            const existingTrainer = await trainerCollection.findOne({ email: trainer.email })
            if (existingTrainer) return res.send({ message: "Trainer already exists", insertedId: null })
            const result = await trainerCollection.insertOne(trainer)
            res.send(result);
        })

        // get applied trainer info from database
        app.get('/trainers', async (req, res) => {
            const trainer = await trainerCollection.find().toArray()
            res.send(trainer);
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