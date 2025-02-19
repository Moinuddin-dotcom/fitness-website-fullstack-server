const express = require('express')
const app = express();
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
        const paymentCollection = database.collection('payments')
        const reviewCollection = database.collection('reviews')
        const blogCollection = database.collection('blogs')

        // jwt token for authorization (localStorage)
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "365d" })
            res.send({ token });
        })

        // jwt middleware: verifyToken
        const verifyToken = (req, res, next) => {
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

        // update user info
        app.patch('/update-user-info/:email', verifyToken, async (req, res) => {
            const updateInfo = req.body;
            const { email } = req.params
            const updateProfile = {
                $set: {
                    ...updateInfo,
                },
            }
            const result = await userCollection.updateOne({ email }, updateProfile)
            res.send(result)
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

        app.get('/users/singleUser/:email', async (req, res) => {
            const { email } = req.params
            const result = await userCollection.findOne({ email })
            res.send(result);
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
            const result = await userCollection.find(query).toArray()
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
            const query = { email: userEmail }
            const trainerData = await userCollection.findOne(query)
            res.send(trainerData);
        })


        app.patch('/updateUser/:id', verifyToken, async (req, res) => {
            const { id } = req.params;
            const userId = { _id: new ObjectId(id) }
            const { slotName, slotTime, selectClass } = req.body;

            try {
                const updateDoc = {
                    $set: {
                        slotName,
                        slotTime,
                        selectClass,
                    }
                }
                const result = await userCollection.updateOne(userId, updateDoc);
                res.send(result);
            } catch (error) {
                res.status(500).json({ message: 'Error updating user data' });
            }
        });

        // changing trainer slots
        app.patch('/updateUser-slots/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const filter = { email }
            const updateRole = {
                $set: {
                    slotName: " ",
                    slotTime: " ",
                    selectClass: " ",
                },
            }
            const result = await userCollection.updateOne(filter, updateRole)
            res.send(result)
        })


        // -----------------------------------------------------------------
        // get trainers data from db by using id
        app.get('/single-trainer-data/:id', async (req, res) => {
            const { id } = req.params
            const query = { _id: new ObjectId(id) }
            const user = await userCollection.findOne(query)
            res.send(user);
        })


        // get slot name which one is added by trainer
        app.get('/trainer-bookings/:id', verifyToken, async (req, res) => {
            const { id } = req.params;
            try {
                const query = { slot: { $elemMatch: { bookedById: id } } };
                const trainerBookings = await classCollection.find(query).toArray();
                if (!trainerBookings.length) {
                    return res.status(404).send({ message: 'No bookings found for this trainer.' });
                }
                res.send(trainerBookings);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: 'Failed to fetch trainer bookings.' });
            }
        });




        // booking trainer details in db
        app.post('/book-trainer', verifyToken, async (req, res) => {
            const updateTrainerInfo = req.body
            const userEmail = req.decoded.email
            const bookingDetails = {
                ...updateTrainerInfo,
                bookedUserEmail: userEmail,
                bookedAt: new Date(),
            }
            const result = await bookedTrainerCollection.insertOne(bookingDetails)
            res.send(result)
        })

        // get book-trainer data by email
        app.get('/book-trainer', async (req, res) => {
            const { bookedUserEmail } = req.query
            const query = { bookedUserEmail: bookedUserEmail }
            const bookedTrainer = await bookedTrainerCollection.find(query).toArray()
            res.send(bookedTrainer);
        })




        // ____________________________________________________________________


        // save all classes in the database
        app.post('/classes', verifyToken, async (req, res) => {
            const classData = req.body
            const result = await classCollection.insertOne(classData)
            res.send(result)
        })

        // get all classes from the database
        app.get('/classes', async (req, res) => {
            const classes = await classCollection.find().toArray()
            res.send(classes);
        })

        // adding search functionality
        app.get('/classes')

        // add trainer slot in classes
        app.patch('/add-slots', verifyToken, async (req, res) => {
            const { bookedById, bookedBy, slotName, slotTime, selectClass, bookedByImage, bookedByName } = req.body;
            const filterClass = await classCollection.findOne({ className: selectClass })
            const updateClassSlot = {
                $push: {
                    slot: {
                        bookedById,
                        bookedBy,
                        bookedByImage,
                        bookedByName,
                        slotName,
                        slotTime,
                    }
                }
            }
            const result = await classCollection.updateOne({ _id: filterClass._id }, updateClassSlot)
            res.send(result);
        })


        // remove trainer slot from classes
        app.patch('/remove-slots', verifyToken, async (req, res) => {
            const { className, bookedByImage, bookedByName, bookedBy, slotName, slotTime, bookedById } = req.body;
            const filterClass = await classCollection.findOne({ className })
            const updateClassSlot = {
                $pull: {
                    slot: {
                        bookedByImage, bookedByName, bookedBy, slotName, slotTime, bookedById
                    }
                }
            }
            const result = await classCollection.updateOne({ _id: filterClass._id }, updateClassSlot)
            res.send(result);
        })


        //save all subscriber on database
        app.post('/subscribers', async (req, res) => {
            const subscriber = req.body
            const existingSubscriber = await subscriberCollection.findOne({ email: subscriber.email })
            if (existingSubscriber) return res.send({ message: "User already exists", insertedId: null })
            const result = await subscriberCollection.insertOne(subscriber)
            res.send(result);
        })

        // get all subscribers
        app.get('/subscribers', async (req, res) => {
            const subscribers = await subscriberCollection.find().toArray()
            res.send(subscribers);
        })



        // Payment intent
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { price } = req.body
            // const amount = parseInt(price * 100)
            if (!price || isNaN(price)) {
                return res.status(400).send({ error: "Invalid price format." });
            }


            const amount = Math.round(price * 100)


            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card'],
            })

            res.send({
                clientSecret: paymentIntent.client_secret,
            })



        })

        // post payment data to database
        app.post('/payments', verifyToken, async (req, res) => {
            const paymentInfo = req.body
            const paymentResult = await paymentCollection.insertOne(paymentInfo)
            res.send(paymentResult);
        })

        // get all paymet
        app.get('/payments', verifyToken, async (req, res) => {
            const payments = await paymentCollection.find().toArray()
            res.send(payments);
        })

        // get booked trainer & user information for payment
        app.get('/payment-info/:email', verifyToken, async (req, res) => {
            const { email } = req.params
            const query = { bookingUserEmail: email }
            const paymentInfo = await paymentCollection.findOne(query)
            res.send(paymentInfo);
        })





        // post review data to database
        app.post('/reviews', verifyToken, async (req, res) => {
            const reviewData = req.body
            const review = await reviewCollection.insertOne(reviewData)
            res.send(review);
        })

        // get all reviews
        app.get('/reviews', async (req, res) => {
            const reviews = await reviewCollection.find().toArray()
            res.send(reviews);
        })

        // post a new blog
        app.post('/blogs', verifyToken, async (req, res) => {
            const forumData = req.body
            const blog = await blogCollection.insertOne(forumData)
            res.send(blog);
        })

        // get blog data
        app.get('/blogs', async (req, res) => {
            const blogs = await blogCollection.find().toArray()
            res.send(blogs)
        })

        // find blog by id
        app.get('/blogsById/:id', verifyToken, async (req, res) => {
            const { id } = req.params
            const query = { _id: new ObjectId(id) }
            const blog = await blogCollection.findOne(query)
            res.send(blog);
        })




        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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