import fs from "fs";
import { parse } from "csv-parse";

// ---------- インプットを確認 ----------

if (process.argv.length !== 3 || !fs.existsSync(process.argv[2])) {
    console.log("コマンド実行の方法: ts-node psm.ts <filename.csv>");
    process.exit(1);
}

const fileName = process.argv[2];

// ---------- 最終的なデータ処理と結果の出力 ----------

function processData(data: { [key: string]: number[] }) {
    const step = 50
    const min_price = findMinPrice(data, step)
    const max_price = findMaxPrice(data, step)

    const final_prices: { [key: string]: number } = {
        '最高価格': findIntersectionPrice(min_price, max_price, step, data["高すぎる"], data["安い"]),
        '妥協価格': findIntersectionPrice(min_price, max_price, step, data["高い"], data["安い"]),
        '理想価格': findIntersectionPrice(min_price, max_price, step, data["高すぎる"], data["安すぎる"]),
        '最低品質保証価格': findIntersectionPrice(min_price, max_price, step, data["高い"], data["安すぎる"]),
    };

    for (let key in final_prices) {
        console.log(`${key}：${final_prices[key]}円`);
    }
}

// ---------- CSVファイルのデータ処理 ----------

const columns: string[][] = [];
fs.createReadStream(fileName, { encoding: 'utf-8' })
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

// ---------- 補助の関数 ---------- 

// サンプルから最小値を見つけて、集計単位から処理に使う最小値を出す
function findMinPrice(data: { [key: string]: number[] }, step: number): number {
    const minPriceSample = Math.min(...Object.values(data).flat());

    return Math.floor(minPriceSample / step) * step;
}

// サンプルから最大値を見つけて、集計単位から処理に使う最大値を出す
function findMaxPrice(data: { [key: string]: number[] }, step: number): number {
    const maxPriceSample = Math.max(...Object.values(data).flat());

    if (maxPriceSample % step === 0) {
        return (Math.floor(maxPriceSample / step) + 1) * step;
    } else {
        return (Math.floor(maxPriceSample / step) + 2) * step;
    }
}

// どの価格で何パーセントの回答者が「高い」「安い」「高すぎる」「安すぎる」と考えたかのデータを集計する
function findPercentage(price: number, sampleData: number[], isExpensive: boolean): number {
    let counter = 0;

    for (let value of sampleData) {
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

    const percentage = (counter / sampleData.length) * 100;
    return Math.round(percentage * 10) / 10;
}

// ４つの価格を集計するための直線のX座標の出力
function findLineRange(min: number, max: number, step: number, expensiveData: number[], cheapData: number[]): number[] {
    const priceSearchList = Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step);

    if (priceSearchList.length === 2) {
        return priceSearchList;
    }

    const middleValue = priceSearchList[Math.floor(priceSearchList.length / 2)];
    const expensivePercentage = findPercentage(middleValue, expensiveData, true);
    const cheapPercentage = findPercentage(middleValue, cheapData, false);

    if (expensivePercentage > cheapPercentage) {
        return findLineRange(min, middleValue, step, expensiveData, cheapData);
    } else {
        return findLineRange(middleValue, max, step, expensiveData, cheapData);
    }
}

// ある２つの直線の交点のX座標を求める
function findXIntersect(line1: [number, number][], line2: [number, number][]): number {
    const [x1, y1] = line1[0];
    const [x2, y2] = line1[1];
    const [x3, y3] = line2[0];
    const [x4, y4] = line2[1];

    const m1 = (y2 - y1) / (x2 - x1);
    const m2 = (y4 - y3) / (x4 - x3);

    const b1 = y1 - m1 * x1;
    const b2 = y3 - m2 * x3;

    const xIntersect = (b2 - b1) / (m1 - m2);

    return xIntersect;
}

// ２つの直線を設定して交点の価格を求める
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

    const xIntersect = findXIntersect(expensiveLine, cheapLine);

    return Math.round(xIntersect);
}