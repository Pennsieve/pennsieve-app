export class TimeseriesDataProcessor {
    static parseProtobufMessage(buffer) {
        try {
            const barray = new Uint8Array(buffer);
            return this.timeSeriesMessage.decode(barray);
        } catch (error) {
            throw new DataParsingError(`Protobuf parsing failed: ${error.message}`);
        }
    }

    static transformSegmentData(segment) {
        const { isMinMax, data: rawData, startTs, samplePeriod } = segment;
        const valueCount = isMinMax ? rawData.length / 2 : rawData.length;

        const transformedData = this.createDataArrays(valueCount);
        const statistics = this.initializeStatistics();

        if (isMinMax) {
            this.processMinMaxData(rawData, transformedData, statistics, startTs, samplePeriod);
        } else {
            this.processContinuousData(rawData, transformedData, statistics, startTs, samplePeriod);
        }

        return {
            data: transformedData,
            statistics,
            metadata: {
                pointCount: valueCount,
                isMinMax,
                samplePeriod
            }
        };
    }

    static createDataArrays(size) {
        return {
            timestamps: new Float64Array(size),
            values: new Float64Array(size),
            maxValues: new Float64Array(size)
        };
    }
}