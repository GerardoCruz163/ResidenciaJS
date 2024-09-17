import express, { response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import stream from 'stream';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { dirname } from 'path';
import { clearInterval } from 'timers';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

//TOKEN DE ACCESO GLOBAL
let tokenAcceso='';
let tknACCESS='';
let preURIUrl='';
let assetID='';
let locationURL='';//OBTENIDA DE CREATEJOB
let downloadURI='';
let jsonGenerado='';


function leerTokenDeArchivo() {
    return new Promise((resolve, reject) => {
        fs.readFile('TOKEN_ACCESO.json', 'utf-8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData.TOKEN);
                } catch (parseErr) {
                    reject(parseErr);
                }
            }
        });
    });
}
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

        tknACCESS ={
            'TOKEN': tokenAcceso
        };
        const tkn=JSON.stringify(tknACCESS, null,2);
        fs.writeFile('TOKEN_ACCESO.json', tkn, 'utf-8',(err)=>{
            if (err) {
                console.error('Error al guardar el TOKEN:', err);
                return;
            }
            console.log('\nArchivo JSON token guardado\n');
        });
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

        const response = await axios.post(preURIEndpoint, body, { headers });
        preURIUrl = response.data.uploadUri;
        assetID=response.data.assetID;
        //console.log('Respuesta de preURI: ', preURIUrl);
        return preURIUrl;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.log('Token no valido. Generando uno nuevo\n');
            tokenAcceso = await getToken(); // Generar un nuevo token y reintentar la solicitud
            return await preURI(); // Reintentar la solicitud con el nuevo token
        } else {
            console.error('Error durante la solicitud a /preURI:', error);
            throw error;
        }
    }
}
// CARGA DEL ARCHIVO
//SUBIR ARCHIVO
async function uploadAsset(uploadUri, fileBuffer){
    try{
        const headers= {
            'Content-Type': 'application/pdf'
        };

        const response = await axios.put(uploadUri, fileBuffer, { headers });
        console.log('\nArchivo importado! ', response.status,'\n');
        console.log('');
    }catch(error) {
        console.error('Error al subir el archivo:', error.response ? error.response.data : error.message);
    }
}
//CARGA EL PDF DE EJEMPLO
async function uploadSamplePDF() {
    try {
        const sampleFilePath = path.join(__dirname, 'FACTURA COMERCIAL 47558.pdf');
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
// app.post('/uploadAsset', upload.single('pdf'), async (req, res) => {
//     try {
//         const fileBuffer = req.file.buffer; // Archivo PDF en binario
//         const uploadUri = req.body.uploadUri; // Debes proporcionar la URL de subida

//         if (!uploadUri) {
//             return res.status(400).send('No se proporciono la URL de subida.');
//         }
//         // Subir el archivo usando la URL proporcionada
//         await uploadAsset(uploadUri, fileBuffer);

//         res.status(200).send('Archivo subido con correctamente.');
//     } catch (error) {
//         console.error('Error en la ruta /uploadAsset:', error.message);
//         res.status(500).send('Error al subir el archivo.');
//     }
// });

async function createJob(assetID) {
    try {
        const endpoint = 'https://pdf-services-ue1.adobe.io/operation/extractpdf';
        const jobData = {
            assetID: assetID,
            getCharBounds: false,
            includeStyling: false,
            elementsToExtract: [
                'text',
                'tables'
            ],
            tableOutputFormat: 'xlsx',
            renditionsToExtract: [
                'tables',
                'figures'
            ],
            notifiers: [
                {
                    type: 'CALLBACK',
                    data: {
                        url: 'https://dummy.callback.org/',
                        headers: {
                            'x-api-key': 'dummykey',
                            'access-token': 'dummytoken'
                        }
                    }
                }
            ]
        };
        const headers = {
            'Authorization': `Bearer ${tokenAcceso}`,
            'x-api-key': process.env.API_KEY,
            'Content-Type': 'application/json'
        };
        const response = await axios.post(endpoint, jobData, { headers });
        const jobLocation = response.headers.location;
        locationURL = response.headers.location;
        console.log('Trabajo creado. Location:', jobLocation);
        return jobLocation;
    } catch (error) {
        console.error('Error al crear el trabajo:', error.response ? error.response.data : error.message);
    }
}
//RUTA PARA CREATEJOB
app.post('/createJob', async (req,res)=>{
    try{
        const assetID=await preURI();
        const jobLocation =await createJob(assetID);

        if (jobLocation) {
            res.status(200).send({ message: 'Trabajo creado: ', location: jobLocation });
            console.log('Locacion: ',jobLocation);
        } else {
            res.status(500).send({ message: 'Error al crear el trabajo.' });
        }
    }catch(error){
        console.error('Error en la ruta /createJob:', error.message);
        res.status(500).send('Error al crear el trabajo.');
    }
});

//getStatusJob
async function getStatusJob(locationURL){
    try{
        const headers={
            'Authorization': `Bearer ${tokenAcceso}`,
            'x-api-key': process.env.API_KEY
        }
        const response = await axios.get(locationURL,{headers});
        //console.log('Estado del trabajo:', response.data);
        downloadURI=response.data.downloadUri;
        //downloadURI=response.data.downloadUri;
        return response.data;
    }catch(error){
        console.error('Error al obtener el estado del trabajo:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function pollJobStatus(locationUrl) {
    const interval = 5000; // Intervalo en milisegundos (8 segundos)
    const poll = setInterval(async () => {
        try {
            const status = await getStatusJob(locationUrl);

            // Verificar el estado del trabajo
            if (status.status === 'done') {  // Cambiado a 'status.status'
                console.log('El trabajo ha finalizado.');

                // Intentar obtener el downloadUri desde content o resource
                downloadURI = status.content?.downloadUri || status.resource?.downloadUri;

                //console.log('Download URI:', downloadURI);

                if (downloadURI) {
                    await downloadAsset(downloadURI);
                } else {
                    console.error('No se encontró un URI de descarga.');
                }
                clearInterval(poll); // Detener el sondeo solo cuando esté completado
            } else if (status.status === 'failed') {  // Cambiado a 'status.status'
                console.error('El trabajo ha fallado.');
                clearInterval(poll); // Detener el sondeo en caso de fallo
            } else {
                console.log('El trabajo aún está en progreso...');
            }
        } catch (error) {
            console.error('Error durante el sondeo del estado del trabajo:', error.message);
            clearInterval(poll);
        }
    }, interval);
}

function isValidURL(string) {
    try {
        // Intentar crear un nuevo objeto URL con la cadena
        new URL(string);
        return true;
    } catch (_) {
        // Si falla, la cadena no es una URL válida
        return false;
    }
}

async function downloadAsset(downloadURI) {
    try {
        //Verificar que downloadURI es válido
        if (!downloadURI || !isValidURL(downloadURI)) {
            throw new Error(`Invalid download URI: ${downloadURI}`);
        }

        //Hacer la solicitud GET a la URI
        const response = await axios.get(downloadURI);
        jsonGenerado = JSON.stringify(response.data, null,2);

        fs.writeFile('PDF_EXPORT.json', jsonGenerado, 'utf-8',(err)=>{
            if (err) {
                console.error('Error al guardar el archivo JSON:', err);
                return;
            }
            console.log('Archivo JSON guardado');
        });
        //console.log('Respuesta JSON: ', jsonGenerado);
        return response.data;
    } catch (error) {
        console.error('Error al descargar:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function startServer() {
    try {
        app.listen(port, () => {
            console.log(`Servidor en el puerto: ${port}`);
        });
        try {
            tokenAcceso = await leerTokenDeArchivo();
            console.log('Token leido del archivo: ', tokenAcceso);

            // Intentar hacer una petición a preURI con el token existente
            await preURI();  // Esto verificará si el token es válido
            console.log('Token valido, continuando con las demas peticiones...');
        } catch (error) {
            // Si hay un error, el token puede estar vencido o inválido, por lo tanto, generar uno nuevo
            console.log('Token no es válido o ha expirado. Generando un nuevo token...');
            tokenAcceso = await getToken();  // Generar y guardar un nuevo token
            await preURI();
        }
        await uploadSamplePDF();
        const jobLocation=await createJob(assetID);

        pollJobStatus(locationURL);
        //console.log(downloadURI);
        //downloadAsset(downloadURI);
    } catch (error) {
        console.error('Error al iniciar servidor: ', error);
    }
}

startServer();