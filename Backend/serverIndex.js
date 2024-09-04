import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import stream from 'stream';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

//TOKEN DE ACCESO GLOBAL
let tokenAcceso='';
let preURIUrl='';

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

//SOLICITUD A PRE URI
async function preURI() {

    try {
        //const url ='';
        const port = process.env.PORT || 8080;
        const preURIEndpoint = `https://pdf-services-ue1.adobe.io/assets`;
        const body = { 'mediaType': 'application/pdf' };
        const bodyJson = JSON.stringify(body);
        const headers = {
            'Authorization': `Bearer ${tokenAcceso}`,
            'x-api-key': process.env.API_KEY,
            'Content-Type': 'application/json'
        };
        
        console.log('\n\n');

        const response = await axios.post(preURIEndpoint, bodyJson, { headers });
        preURIUrl = response.data.uploadUri;
        console.log('Respuesta de preURI: ', preURIUrl);
        return preURIUrl;
    } catch (error) {
        console.log('Error capturado en el catch.');
        console.error('Error durante la solicitud a /preURI:', {
            message: error.message || 'No hay mensaje',
            stack: error.stack || 'No hay traza',
            config: error.config || 'No hay configuración',
            code: error.code || 'No hay código de error',
            response: error.response ? {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            } : 'No hay respuesta'
        });
    }
}

//SUBIR ARCHIVO
async function uploadAsset(uploadUri){
    try{
        const filePath = path.join(__dirname, '/CRONOGRAMA.pdf');
        const fileStream = fs.createReadStream(filePath);

        const headers={
            'Content-Type': 'application/pdf'
        };

        const response = await axios.put(uploadUri, fileStream, { headers });
        console.log('Archivo importado! ', response.status);
    }catch(error) {
        console.error('Error al subir el archivo:', error.response ? error.response.data : error.message);
    }
}

async function startServer() {
    try {
        app.listen(port, () => {
            console.log(`Servidor en el puerto: ${port}`);
        });
        await getToken(); // Esperar a obtener el token
        await preURI();  // Esperar a realizar la solicitud preURI
        await uploadAsset(preURIUrl);
    } catch (error) {
        console.error('Error al iniciar servidor: ', error);
    }
}

startServer();