const express = require('express')
const cors = require('cors')
const app = express()
const stripe = require('stripe')('sk_test_51SZYkUPivW4arOGoqEu8XHAfLpG3cIv572uGCfuOVvR5wr0mWe6l8VPVzWcVvvMEtQb2huvBSop58d1iHUF2E1aX00yXNERRy8');
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// Mongo db uri
const uri = "mongodb+srv://Nihal:3EymKVfP19tT0X7B@toy-topia-cluster.nnrm3bm.mongodb.net/?appName=toy-topia-cluster";

// client
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.get('/', (req, res) => {
    res.send('Hello World!')
})

// 3EymKVfP19tT0X7B
// /Nihal

async function run() {
    try {
        const db = client.db('toysDB')
        const toysCollection = db.collection('toys')
        const cartCollection = db.collection('cart')
        const orderCollection = db.collection('orders')
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // all toys
        app.get('/toys', async (req, res) => {
            const result = await toysCollection.find().toArray()
            res.send(result)
        })


        app.post('/create-checkout-session', async (req, res) => {
            const { cartItems, userEmail } = req.body;

            // Map your cart items to Stripe's specific format
            const line_items = cartItems.map((item) => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name,
                        images: [item.image],
                    },
                    unit_amount: Math.round(parseFloat(item.price) * 100), // Stripe uses cents
                },
                quantity: 1,
            }));

            // Add Shipping fee
            line_items.push({
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Express Shipping' },
                    unit_amount: 1000, // $10.00
                },
                quantity: 1,
            });

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items,
                mode: 'payment',
                // Redirect back to your success page
                success_url: `http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `http://localhost:5173/cart`,
                customer_email: userEmail,
            });

            res.send({ url: session.url });
        });

        // 2. Save Official Order and add "Paid" status
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const finalOrder = {
                ...order,
                status: "Paid", // Automatically adding the status field
                orderTimestamp: new Date(),
            };
            const result = await orderCollection.insertOne(finalOrder);
            res.send(result);
        });

        // 3. Clear Cart for a specific user
        app.delete('/clear-cart', async (req, res) => {
            const email = req.query.email;
            const result = await cartCollection.deleteMany({ addedBy: email });
            res.send(result);
        });



        // CART=====

        app.get('/cart', async (req, res) => {
            let query = {};
            // Check if an email was provided in the query string
            if (req.query?.email) {
                query = { addedBy: req.query.email };
            }

            const cursor = cartCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.post('/cart', async (req, res) => {
            const data = req.body
            const result = await cartCollection.insertOne(data)
            res.send(result)
        })


        app.delete('/cart/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        });


        app.delete('/clear-cart', async (req, res) => {
            try {
                const email = req.query.email;

                // Validation: Ensure email is provided to avoid accidental full wipe
                if (!email) {
                    return res.status(400).send({ message: "Email is required to clear cart" });
                }

                const query = { addedBy: email };
                const result = await cartCollection.deleteMany(query);

                if (result.deletedCount > 0) {
                    res.send({
                        success: true,
                        message: `Cleared ${result.deletedCount} items from cart.`,
                        deletedCount: result.deletedCount
                    });
                } else {
                    res.send({
                        success: true,
                        message: "Cart was already empty.",
                        deletedCount: 0
                    });
                }
            } catch (error) {
                console.error("Error clearing cart:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });
        // search toys
        app.get('/toys/search/:text', async (req, res) => {
            const searchText = req.params.text || '';
            const result = await toysCollection
                .find({ name: { $regex: searchText, $options: 'i' } })
                .toArray();
            res.json(result);
        });
        // Orders===>

        // my order

        app.get('/my-orders', async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send({ message: "Email required" });

            // Sort by date: -1 means "newest first"
            const result = await orderCollection.find({ email: email })
                .sort({ orderDate: -1 })
                .toArray();
            res.send(result);
        });

        app.post('/orders', async (req, res) => {
            try {
                const orderData = req.body;

                // Construct the final order object
                const finalOrder = {
                    // Spread the data sent from frontend (items, user email, total price)
                    ...orderData,

                    // System-generated fields
                    status: "Paid",             // Your requested status field
                    paymentMethod: "Stripe",
                    orderDate: new Date(),      // Helps with "Sort by Date" later
                    orderId: `TT-${Math.floor(100000 + Math.random() * 900000)}` // Unique Order ID
                };

                const result = await orderCollection.insertOne(finalOrder);

                if (result.insertedId) {
                    res.send({
                        success: true,
                        message: "Order placed successfully!",
                        insertedId: result.insertedId
                    });
                } else {
                    res.status(500).send({ message: "Failed to save order to database" });
                }
            } catch (error) {
                console.error("Order POST Error:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });





        app.get('/toys/filter/high', async (req, res) => {
            try {
                const result = await toysCollection.find().sort({ price: -1 }).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Server error" });
            }
        });




        // LOW TO HIGH
        app.get('/toys/filter/low', async (req, res) => {
            try {
                const result = await toysCollection.find().sort({ price: 1 }).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Server error" });
            }
        });


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
        app.listen(port, () => {
            console.log(`Example app listening on port ${port}`)
        })
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

