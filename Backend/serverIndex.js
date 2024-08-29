import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import stream from 'stream';

import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3021;

async function getToken(){
    try{
        const clientId = process.env.API_KEY;
        const adobeApiSecret = process.env.API_SECRET;
        console.log('Client ID (API KEY): ',clientId);
        console.log('Api secret: ',adobeApiSecret);

        const endpoint = 'https://pdf-services-ue1.adobe.io/token';

        //PARAMETROS QUE NECESITA LA SOLICITUD DE UN NUEVO TOKEN
        const params=new URLSearchParams();
        params.append('client_id', clientId);
        params.append('client_secret', adobeApiSecret);

        //AQUI SE HACE LA SOLICITUD
        //COLOCO EL ENDPOINT DONDE SE ENVIA LA SOLICITUD Y SUS RESPECTIVOS PARAMETROS
        const response = await axios.post(endpoint, params);

        //MUESTRO EL TOKEN QUE OBTUVE
        const accessToken =response.data.access_token;
        console.log('Token de acceso nuevo: ',accessToken);

        return accessToken;
    }catch(error){
        console.error('Error durante el proceso. Error: ', error);
        throw error;
    }
}

app.listen(port, () => {
    console.log(`Servidor en el puerto: ${port}`);
    const token = getToken();
});