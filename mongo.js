const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
const atlasURL = process.env.ATLAS_URL;

module.exports = {
    getUserFromSessionKey: async function(sessionKey) {
        const client = await new MongoClient(atlasURL, { useNewUrlParser: true });
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('triage');
        const sessionsCollection = db.collection('sessions');

        const sessionDocument = await sessionsCollection.findOne({ _id: ObjectId(sessionKey) });
        if (!sessionDocument) {
            throw new Error('Invalid Session Key');
        }

        const usersCollection = db.collection('users');
        const userDocument = await usersCollection.findOne({ _id: sessionDocument.user });
        if (!userDocument) {
            throw new Error('User Does Not Exist');
        }
        return userDocument;
    },
    createUser: async function(username, password, displayName) {
        const client = await new MongoClient(atlasURL, { useNewUrlParser: true });
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('triage');
        const usersCollection = db.collection('users');
        // verify username is unique
        let doc = await usersCollection.findOne({ username });
        if (doc) {
            throw new Error('Username taken');
        }
        await usersCollection.insertOne({
            username,
            password,
            displayName
        })
        const userDocument = await usersCollection.findOne({ username, password, displayName });
        return userDocument;
    },
    createSession: async function(userId) {
        const client = await new MongoClient(atlasURL, { useNewUrlParser: true });
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('triage');
        const sessionsCollection = db.collection('sessions');
        const ret = await sessionsCollection.insertOne({ user: userId })
        return { sessionKey: ret.insertedId.toString(), userId: userId.toString() };
    },
    verifyPassword: async function(username, password) {
        const client = await new MongoClient(atlasURL, {useNewUrlParser: true});
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('triage');
        const usersCollection = db.collection('users');
        const userDocument = await usersCollection.findOne({username});
        if (!userDocument) {
            throw new Error('Invalid Credentials');
        }
        if (userDocument.password === password) {
            return userDocument;
        } else {
            throw new Error('Invalid Credentials');
        }
    },
    getItemsForUser: async function (userObjectId) {
        const client = await new MongoClient(atlasURL, {useNewUrlParser: true});
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('triage');
        const itemsCollection = db.collection('items');
        const ret = await itemsCollection.find({ user: userObjectId, deleted: false}).toArray();
        return ret;
    },
    addItem: async function(userObjectId, body) {
        const client = await new MongoClient(atlasURL, {useNewUrlParser: true});
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('triage');
        const itemsCollection = db.collection('items');
        await itemsCollection.insertOne({... body, user: userObjectId, deleted: false, _id: ObjectId(body.id) })
    },
    modifyItem: async function(itemId, newValueMap) {
        const client = await new MongoClient(atlasURL, {useNewUrlParser: true});
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('triage');
        const itemsCollection = db.collection('items');
        await itemsCollection.updateOne({_id: ObjectId(itemId) }, { $set: newValueMap });
    },
    deleteItem: async function(itemId) {
        const client = await new MongoClient(atlasURL, {useNewUrlParser: true});
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('triage');
        const itemsCollection = db.collection('items');
        await itemsCollection.deleteOne({_id: ObjectId(itemId)});
    },
    /*
    Technical Achievement
    This is a soft delete but I'm calling it a facebookDelete for the joke.
    Doesn't actually delete data, just triggers flag to pretend we deleted it so we can continue to harvest data
    that the user thinks we deleted.
    $$$$$$$$$$
    $ Stonks $
    $$$$$$$$$$
     */
    facebookDeleteItem: async function(itemId) {
        const client = await new MongoClient(atlasURL, {useNewUrlParser: true});
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('triage');
        const itemsCollection = db.collection('items');
        await itemsCollection.findOneAndUpdate({_id: ObjectId(itemId)}, { $set: { deleted: true} });
    }
}
