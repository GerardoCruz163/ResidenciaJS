//const express = require('express');
//const fetch = require('node-fetch');
import express from 'express';
import fetch from 'node-fetch';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const dotenv = await import('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3021;

app.use(express.json());
const upload = multer({ dest: 'uploads/' });

app.post('/extract-pdf', upload.single('pdfFile'), async(req,res)=>{
    const pdfFilePath = req.file.path;

    try{
        const pdfFileBuffer = fs.readFileSync(pdfFilePath);
        const response = await fetch('https://pdf-services-ue1.adobe.io/operation/extractpdf',{
            method: 'POST',
            headers:{
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'X-API-KEY': process.env.API_KEY,
                'Content-Type': 'application/pdf',
            },
            body: pdfFileBuffer,
        });

        if(!response.ok){
            const errorBody = await response.text();
            throw new Error(`ERROR HTTP, ESTADO: ${response.status}, RESPUESTA: ${errorBody}`);
        }

        const data = await response.json();
        res.status(200).json(data);
    }catch(error){
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }finally{
        fs.unlinkSync(pdfFilePath);
    }
});

//INICIALIZACION DEL SERVIDOR
app.listen(PORT, () =>{
    console.log(`Servidor jalando en http://localhost:${PORT}`);
});