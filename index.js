const express = require('express')
const cors = require('cors')
const app = express()
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
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // all toys
        app.get('/toys', async (req, res) => {
            const result = await toysCollection.find().toArray()
            res.send(result)
        })
        // add toys
        app.post('/toys', async (req, res) => {
            const data = req.body
            const result = await toysCollection.insertOne(data)
            res.send(result)
        })
        // search toys
        app.get('/toys/search/:text', async (req, res) => {
            const searchText = req.params.text || '';
            const result = await toysCollection
                .find({ toyName: { $regex: searchText, $options: 'i' } })
                .toArray();
            res.json(result);
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

