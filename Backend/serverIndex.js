import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import stream from 'stream';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import multer from 'multer';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

//TOKEN DE ACCESO GLOBAL
let tokenAcceso='';
let preURIUrl='';
let assetID='';

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
        //console.log('Token expira en: ', tokenExpiraEn);

        return tokenAcceso;
    }catch(error){
        console.error('Error durante el proceso. Error: ', error);
        throw error;
    }
}  

//SOLICITUD A PRE URI
async function preURI() {

    try {
        //const port = process.env.PORT || 8080;
        const preURIEndpoint = `https://pdf-services-ue1.adobe.io/assets`;
        const body = { 'mediaType': 'application/pdf' };
        const headers = {
            'Authorization': `Bearer ${tokenAcceso}`,
            'x-api-key': process.env.API_KEY,
            'Content-Type': 'application/json'
        };
        
        console.log('\n');

        const response = await axios.post(preURIEndpoint, body, { headers });
        preURIUrl = response.data.uploadUri;
        assetID=response.data.assetID;
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

// CARGA DEL ARCHIVO
//SUBIR ARCHIVO
async function uploadAsset(uploadUri, fileBuffer){
    try{
        const headers= {
            'Content-Type': 'application/pdf'
        };

        const response = await axios.put(uploadUri, fileBuffer, { headers })
        console.log('Archivo importado! ', response.status);
        console.log('')
    }catch(error) {
        console.error('Error al subir el archivo:', error.response ? error.response.data : error.message);
    }
}
//CARGA EL PDF DE EJEMPLO
async function uploadSamplePDF() {
    try {
        const sampleFilePath = path.join(__dirname, 'Downloads', 'PDF_EJEMPLO.pdf');
        const fileBuffer = fs.readFileSync(sampleFilePath);

        if (!preURIUrl) {
            throw new Error('URL de subida no disponible.');
        }

        await uploadAsset(preURIUrl, fileBuffer);
        console.log('Archivo PDF de muestra subido exitosamente.');
    } catch (error) {
        console.error('Error al subir el archivo PDF de muestra:', error.message);
    }
}

// RUTA PARA RECIBIR EL ARCHIVO Y SUBIRLO
app.post('/uploadAsset', upload.single('pdf'), async (req, res) => {
    try {
        const fileBuffer = req.file.buffer; // Archivo PDF en binario
        const uploadUri = req.body.uploadUri; // Debes proporcionar la URL de subida

        if (!uploadUri) {
            return res.status(400).send('No se proporcionó la URL de subida.');
        }

        // Subir el archivo usando la URL proporcionada
        await uploadAsset(uploadUri, fileBuffer);

        res.status(200).send('Archivo subido con éxito.');
    } catch (error) {
        console.error('Error en la ruta /uploadAsset:', error.message);
        res.status(500).send('Error al subir el archivo.');
    }
});

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