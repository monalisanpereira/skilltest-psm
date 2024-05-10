import * as fs from "fs";
import { parse } from "csv-parse";

if (process.argv.length !== 3 || !fs.existsSync(process.argv[2])) {
    console.log("使い方: ts-node psm.ts <filename.csv>");
    process.exit(1);
}

const filename = process.argv[2];

function processData(data: { [key: string]: number[] }) {
    const step = 50
    const min_price = findMinPrice(data, step)
    const max_price = findMaxPrice(data, step)

    const final_prices: { [key: string]: number } = {
        '最高価格': findIntersectionPrice(min_price, max_price, step, data["高すぎる"], data["安い"]),
        '妥協価格': findIntersectionPrice(min_price, max_price, step, data["高い"], data["安い"]),
        '理想価格': findIntersectionPrice(min_price, max_price, step, data["高すぎる"], data["安すぎる"]),
        '最低品質保証価格': findIntersectionPrice(min_price, max_price, step, data["高い"], data["安すぎる"])
    };

    for (const key of Object.keys(final_prices)) {
        console.log(`${key}：${final_prices[key]}円`);
    }
}

const columns: string[][] = [];
fs.createReadStream(filename, { encoding: 'utf-8' })
    .pipe(parse())
    .on('data', (row: any) => {
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
        const data: { [key: string]: number[] } = {};
        for (let i = 1; i < columns.length; i++) {
            const columnName = columns[i][0];
            const values = columns[i].slice(1).map((value: string) => parseInt(value));
            data[columnName] = values;
        }
        processData(data);
    });

function findMinPrice(data: { [key: string]: number[] }, step: number): number {
    const minPriceSample = Math.min(...Object.values(data).flatMap(values => values));
    return Math.floor(minPriceSample / step) * step;
}

function findMaxPrice(data: { [key: string]: number[] }, step: number): number {
    const maxPriceSample = Math.max(...Object.values(data).flatMap(values => values));

    if (maxPriceSample % step === 0) {
        return (Math.floor(maxPriceSample / step) + 1) * step;
    } else {
        return (Math.floor(maxPriceSample / step) + 2) * step;
    }
}

function findPercentage(price: number, sampleData: number[], isExpensive: boolean): number {
    let counter: number = 0;

    for (const value of sampleData) {
        if (isExpensive) {
            if (value <= price) {
                counter++;
            }
        } else {
            if (value >= price) {
                counter++;
            }
        }
    }

    const percentage: number = (counter / sampleData.length) * 100;
    return Math.round(percentage * 10) / 10;
}

function findLineRange(min: number, max: number, step: number, expensiveData: number[], cheapData: number[]): number[] {
    const priceSearchList: number[] = Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step);

    if (priceSearchList.length === 2) {
        return priceSearchList;
    }

    const middleValue: number = priceSearchList[Math.floor(priceSearchList.length / 2)];
    const expensivePercentage: number = findPercentage(middleValue, expensiveData, true);
    const cheapPercentage: number = findPercentage(middleValue, cheapData, false);

    if (expensivePercentage > cheapPercentage) {
        return findLineRange(min, middleValue, step, expensiveData, cheapData);
    } else {
        return findLineRange(middleValue, max, step, expensiveData, cheapData);
    }
}

function findXIntersect(line1: [number, number][], line2: [number, number][]): number {
    const [x1, y1] = line1[0];
    const [x2, y2] = line1[1];
    const [x3, y3] = line2[0];
    const [x4, y4] = line2[1];

    const m1: number = (y2 - y1) / (x2 - x1);
    const m2: number = (y4 - y3) / (x4 - x3);

    const b1: number = y1 - m1 * x1;
    const b2: number = y3 - m2 * x3;

    const xIntersect: number = (b2 - b1) / (m1 - m2);

    return xIntersect;
}

function findIntersectionPrice(minPrice: number, maxPrice: number, step: number, expensiveData: number[], cheapData: number[]): number {
    const [min, max]: number[] = findLineRange(minPrice, maxPrice, step, expensiveData, cheapData);

    const expensiveLine: [number, number][] = [
        [min, findPercentage(min, expensiveData, true)],
        [max, findPercentage(max, expensiveData, true)]
    ];
    
    const cheapLine: [number, number][] = [
        [min, findPercentage(min, cheapData, false)],
        [max, findPercentage(max, cheapData, false)]
    ];

    const xIntersect: number = findXIntersect(expensiveLine, cheapLine);

    return Math.round(xIntersect);
}


