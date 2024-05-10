import * as fs from "fs";
import { parse } from 'csv-parse';

// Check if the correct number of command-line arguments is provided
if (process.argv.length !== 3) {
    console.log("Usage: ts-node psm.ts <filename.csv>");
    process.exit(1);
}

// Read the filename from the command-line argument
const filename = process.argv[2];

const columns: string[][] = [];
fs.createReadStream(filename, { encoding: 'utf-8' })
    .pipe(parse())
    .on('data', (row: any) => {
        // Extract column names and values
        const columnNames = Object.keys(row);
        for (let i = 0; i < columnNames.length; i++) {
            const columnName = columnNames[i];
            const value = row[columnName];
            if (columns[i]) {
                columns[i].push(value);
            } else {
                columns[i] = [value];
            }
        }
    })
    .on('end', () => {
        // Process columns to create data object
        const data: { [key: string]: number[] } = {};
        for (let i = 1; i < columns.length; i++) {
            const columnName = columns[i][0];
            const values = columns[i].slice(1).map((value: string) => parseInt(value));
            data[columnName] = values;
        }
    });