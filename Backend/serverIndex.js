import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import stream from 'stream';

import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3021;

app.use(express.json());

//TOKEN DE ACCESO GLOBAL
let tokenAcceso='';

//OBTENER TOKEN NUEVO
async function getToken(){
    try{
        //CLIENTID Y API_SECRET (PARAMETROS REQUERIDOS PARA LA PETICION)
        const clientId = process.env.API_KEY;
        const adobeApiSecret = process.env.API_SECRET;
        //ENDPOINT PARA OBTENER EL TOKEN NUEVO
        const endpoint = 'https://pdf-services-ue1.adobe.io/token';
        //PARAMETROS QUE NECESITA LA SOLICITUD DE UN NUEVO TOKEN
        const params=new URLSearchParams();
        params.append('client_id', clientId);
        params.append('client_secret', adobeApiSecret);
        //AQUI SE HACE LA SOLICITUD
        //COLOCO EL ENDPOINT DONDE SE ENVIA LA SOLICITUD Y SUS RESPECTIVOS PARAMETROS
        const response = await axios.post(endpoint, params);
        //GUARDO EL TOKEN EN LA VARIABLE GLOBAL
        tokenAcceso =response.data.access_token;
        //muestro el token nuevo en la consola
        console.log('Token de acceso nuevo: ',tokenAcceso);
        return tokenAcceso;
    }catch(error){
        console.error('Error durante el proceso. Error: ', error);
        throw error;
    }
}

//OBTENER PREURI
app.post('/preURI', async (req, res) => {
    try {
        const preURIEndpoint = 'https://pdf-services-ue1.adobe.io/assets';
        const mediaType = req.body.mediaType;

        if (!mediaType) {
            return res.status(400).json({ error: 'Falta el parametro mediaType en el cuerpo de la solicitud' });
        }

        if (!tokenAcceso) {
            return res.status(400).json({ error: 'Token de acceso no disponible' });
        }

        console.log('Token de acceso:', tokenAcceso);
        console.log('API Key:', process.env.API_KEY);

        const headers = {
            'Authorization': `Bearer ${tokenAcceso}`, // Token de acceso
            'x-api-key': process.env.API_KEY,
            'Content-Type': 'application/json'
        };

        const body = {
            mediaType: mediaType
        };

        const response = await axios.post(preURIEndpoint, body, { headers });

        console.log('Respuesta de url: ', response.data.uploadUri);
        res.json(response.data);
    } catch (error) {
        console.error('Error al crear URL ', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});


//SOLICITUD A PRE URI
async function preURI(){
    try{
        const preURIEndpoint = 'http://localhost:3021/preURI';
        const body = {mediaType: 'application/pdf'};
        const headers= {
            'Authorization': `Bearer ${tokenAcceso}`,
            'x-api-key': `${process.env.API_KEY}`,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(preURIEndpoint, body, { headers });
        console.log('Respuesta de preURI: ',response.data.uploadUri);
    }catch(error){
        console.error('Error durante la solicitud a /preURI:', {
            message: error.message,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            } : undefined
        });
    }
}

async function startServer() {
    try {
        await getToken(); // Esperar a obtener el token
        await preURI();  // Esperar a realizar la solicitud preURI

        app.listen(port, () => {
            console.log(`Servidor en el puerto: ${port}`);

            console.log('Token de acceso:', tokenAcceso);
            console.log('API Key:', process.env.API_KEY);
        });
    } catch (error) {
        console.error('Error al iniciar servidor: ', error);
    }
}

startServer();