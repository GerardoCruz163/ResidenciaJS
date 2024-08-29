import express from 'express';
import axios from 'axios';
const app = express();
const PORT = 3021; 

app.use(express.json());

app.post('/createJob', async (req, res) => {
    try {
        const assetID = req.body.assetID || 'urn:aaid:AS:UE1:493a0607-f703-4723-bdc5-f5b04aa02b5d';
        const jobOptions = {
            assetID: assetID,
            getCharBounds: false,
            includeStyling: false,
            elementsToExtract: [
                "text",
                "tables"
            ],
            tableOutputFormat: "xlsx",
            renditionsToExtract: [
                "tables",
                "figures"
            ],
            includeHeaderFooter: false,
            tagEncapsulatedText: [
                "Figure"
            ],
            notifiers: [
                {
                    type: "CALLBACK",
                    data: {
                        url: "https://webhook.site/tu-unique-url",
                        headers: {
                            "x-api-key": process.env.API_KEY,
                            "access-token": process.env.ACCESS_TOKEN
                        }
                    }
                }
            ]
        };

        const config = {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`, //TOKEN DE ACCESO
                'Content-Type': 'application/json',
                'x-api-key': process.env.API_KEY //API KEY
            }
        };

        const response = await axios.post('https://pdf-services-ue1.adobe.io/operation/createJob', jobOptions, config);

        res.status(200).send({ message: 'Trabajo creado exitosamente', data: response.data });
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        res.status(500).send({ error: error.response ? error.response.data : error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
