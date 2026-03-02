import {isNil, path, pathOr, propOr} from "ramda";

export default {
  data: function() {
    return {
      typeMapper: {
        Image: 'image',
        MRI: 'mri',
        PDF: 'pdf',
        Slide: 'slide',
        Tabular: 'tabular',
        TimeSeries: 'timeseries',
        Video: 'video',
        Text: 'text',
        ZIP: 'zip',
        CSV: 'csv',
        OMETIFF: 'omeTiff'
      },
      fileTypes: [
        {
          value: 'PDF',
          label: 'PDF (.pdf)'
        },
        {
          value: 'MEF',
          label: 'MEF (.mef)'
        },
        {
          value: 'EDF',
          label: 'EDF (.edf)'
        },
        {
          value: 'TDMS',
          label: 'TDMS (.tdms)'
        },
        {
          value: 'Persyst',
          label: 'Persyst (.lay)'
        },
        {
          value: 'DICOM',
          label: 'DICOM (.dicom)'
        },
        {
          value: 'NIFTI',
          label: 'Viewer (.nifti)'
        },
        {
          value: 'PNG',
          label: 'PNG (.png)'
        },
        {
          value: 'CZI',
          label: 'CZI (.czi)'
        },
        {
          value: 'Aperio',
          label: 'Aperio (.aperio)'
        },
        {
          value: 'Json',
          label: 'Json (.json)'
        },
        {
          value: 'CSV',
          label: 'CSV (.csv)'
        },
        {
          value: 'TSV',
          label: 'TSV (.tsv)'
        },
        {
          value: 'Text',
          label: 'Text (.txt)'
        },
        {
          value: 'XML',
          label: 'XML (.xml)'
        },
        {
          value: 'HTML',
          label: 'HTML (.html)'
        },
        {
          value: 'MSExcel',
          label: 'MSExcel (.xls / .xlsx)'
        },
        {
          value: 'MSWord',
          label: 'MSWord (.doc / .docx)'
        },
        {
          value: 'MP4',
          label: 'MP4 (.mp4)'
        },
        {
          value: 'WEBM',
          label: 'WEBM ('
        },
        {
          value: 'OGG',
          label: 'OGG'
        },
        {
          value: 'MOV',
          label: 'MOV'
        },
        {
          value: 'JPEG',
          label: 'JPEG'
        },
        {
          value: 'JPEG2000',
          label: 'JPEG2000'
        },
        {
          value: 'LSM',
          label: 'LSM'
        },
        {
          value: 'NDPI',
          label: 'NDPI'
        },
        {
          value: 'OIB',
          label: 'OIB'
        },
        {
          value: 'ROI',
          label: 'ROI'
        },
        {
          value: 'SWC',
          label: 'SWC'
        },
        {
          value: 'CRAM',
          label: 'CRAM'
        },
        {
          value: 'MGH',
          label: 'MGH'
        },
        {
          value: 'AVI',
          label: 'AVI'
        },
        {
          value: 'MATLAB',
          label: 'MATLAB (.mat)'
        },
        {
          value: 'HDF5',
          label: 'HDF5'
        },
        {
          value: 'TIFF',
          label: 'TIFF'
        },
        {
          value: 'OMETIFF',
          label: 'OMETIFF'
        },
        {
          value: 'BRUKERTIFF',
          label: 'BRUKERTIFF'
        },
        {
          value: 'GIF',
          label: 'GIF'
        },
        {
          value: 'ANALYZE',
          label: 'ANALYZE'
        },
        {
          value: 'NeuroExplorer',
          label: 'NeuroExplorer'
        },
        {
          value: 'MINC',
          label: 'MINC'
        },
        {
          value: 'Blackrock',
          label: 'Blackrock'
        },
        {
          value: 'MobergSeries',
          label: 'MobergSeries'
        },
        {
          value: 'GenericData',
          label: 'GenericData'
        },
        {
          value: 'Nicolet',
          label: 'Nicolet'
        },
        {
          value: 'MEF3',
          label: 'MEF3'
        },
        {
          value: 'Feather',
          label: 'Feather'
        },
        {
          value: 'NEV',
          label: 'NEV'
        },
        {
          value: 'Spike2',
          label: 'Spike2'
        },
        {
          value: 'AdobeIllustrator',
          label: 'AdobeIllustrator'
        },
        {
          value: 'AFNI',
          label: 'AFNI'
        },
        {
          value: 'AFNIBRIK',
          label: 'AFNIBRIK'
        },
        {
          value: 'Ansys',
          label: 'Ansys'
        },
        {
          value: 'BAM',
          label: 'BAM'
        },
        {
          value: 'BIODAC',
          label: 'BIODAC'
        },
        {
          value: 'BioPAC',
          label: 'BioPAC'
        },
        {
          value: 'COMSOL',
          label: 'COMSOL'
        },
        {
          value: 'CPlusPlus',
          label: 'C++'
        },
        {
          value: 'CSharp',
          label: 'C#'
        },
        {
          value: 'Docker',
          label: 'Docker'
        },
        {
          value: 'EPS',
          label: 'EPS'
        },
        {
          value: 'FCS',
          label: 'FCS'
        },
        {
          value: 'FASTA',
          label: 'FASTA'
        },
        {
          value: 'FASTQ',
          label: 'FASTQ'
        },
        {
          value: 'FreesurferSurface',
          label: 'FreesurferSurface'
        },
        {
          value: 'FSFast',
          label: 'FSFast'
        },
        {
          value: 'HDF',
          label: 'HDF'
        },
        {
          value: 'Imaris',
          label: 'Imaris'
        },
        {
          value: 'Intan',
          label: 'Intan'
        },
        {
          value: 'IVCurveData',
          label: 'IVCurveData'
        },
        {
          value: 'JAVA',
          label: 'JAVA'
        },
        {
          value: 'Javascript',
          label: 'Javascript'
        },
        {
          value: 'Jupyter',
          label: 'Jupyter'
        },
        {
          value: 'LabChart',
          label: 'LabChart'
        },
        {
          value: 'Leica',
          label: 'Leica'
        },
        {
          value: 'MatlabFigure',
          label: 'MatlabFigure'
        },
        {
          value: 'Markdown',
          label: 'Markdown'
        },
        {
          value: 'Minitab',
          label: 'Minitab'
        },
        {
          value: 'Neuralynx',
          label: 'Neuralynx'
        },
        {
          value: 'NeuroDataWithoutBorders',
          label: 'NWB'
        },
        {
          value: 'Neuron',
          label: 'Neuron'
        },
        {
          value: 'NihonKoden',
          label: 'NihonKoden'
        },
        {
          value: 'Nikon',
          label: 'Nikon'
        },
        {
          value: 'PatchMaster',
          label: 'PatchMaster'
        },
        {
          value: 'PClamp',
          label: 'PClamp'
        },
        {
          value: 'Plexon',
          label: 'Plexon'
        },
        {
          value: 'PowerPoint',
          label: 'PowerPoint'
        },
        {
          value: 'Python',
          label: 'Python'
        },
        {
          value: 'R',
          label: 'R'
        },
        {
          value: 'RData',
          label: 'RData'
        },
        {
          value: 'Shell',
          label: 'Shell'
        },
        {
          value: 'SolidWorks',
          label: 'SolidWorks'
        },
        {
          value: 'VariantData',
          label: 'VariantData'
        },
        {
          value: 'YAML',
          label: 'YAML'
        },
        {
          value: 'ZIP',
          label: 'ZIP'
        },
      ],

      whitelist: [
        'go',
        'c#',
        'c++',
        'java',
        'javascript',
        'yaml',
        'xml',
        'sigmaplot',
        'shell',
        'bash',
        'ansys',
        'neuron',
        'markdown',
        'r',
        'python',
        'matlab',
        'apache',
        'php',
        'css',
        'json',
        'ruby',
        'html',
        'dockerfile',
        'ini',
        'scala',
        'tex',
        'mathematica',
        'stata',
        'text',
        'code'
      ]
    }
  },

  methods: {
    checkViewerType: function(pkg) {
      const packageState = path(['content', 'state'], pkg)

      const packageType = pathOr('unknown', ['content', 'packageType'], pkg)
      const packageProperties = propOr([], 'properties', pkg)
      let component = packageType.toLowerCase()
      if ((isNil(this.typeMapper[packageType]) || packageState === 'ERROR')) {
        component = 'unknown';
      }

      // NOTE: temporary logic to handle "Unsupported" packageType value for text files
      const subtype = this.getFilePropertyVal(packageProperties, 'subtype').toLowerCase()
      if (this.whitelist.indexOf(subtype) >= 0) {
        component = 'text'
      }

      if (subtype === 'ms excel') {
        component = 'xls'
      }

      if (this.isCollectionWithAViewer(pkg)) {
        component = 'timeseries'
      }
      const vueViewerMap = {
        image: ['ImageViewer'],
        pdf: ['PDFViewer'],
        text: ['TextViewer'],
        unknown:['UnknownViewer'],
        video: ['VideoViewer'],
        slide: ['SlideViewer'],
        timeseries: ['TimeseriesViewer'],
        csv: ['CSVViewer', 'DataExplorer'],
        xls: ['XLSViewer'],
        parquet_umap_viewer: ['DataExplorer', 'UMAPViewer' ],
        mri: ['NiiViewer'],
        tabular: ['CSVViewer','DataExplorer'],
        omeTiff: ['OmeViewer'],
      }

      // OME-TIFF check based solely on filename - takes precedence over packageType
      if (this.isOMETiff(pkg)) {
        return vueViewerMap['omeTiff']
      }

      // Parquet file check based on filename - for UMAP visualization
      if (this.isParquetFile(pkg)) {
        return vueViewerMap['parquet_umap_viewer']
      }

      const vueViewers = ['image', 'pdf', 'text', 'unknown', 'video', 'slide','timeseries', 'csv', 'xls', 'rds','mri', 'tabular', 'omeTiff']

      // TODO: This currently picks the first of the viewers and should be replaced by more solid support
      for (let i in packageProperties) {
        if (packageProperties[i].category === "ViewerSupport") {
          let mappedViewer = packageProperties[i].properties[0]['key'].replaceAll("-", "_");
          return vueViewerMap[mappedViewer]
        }
      }

      // Check for properties
      if (packageProperties['ViewerSupport']) {
        console.log(packageProperties['ViewerSupport'])
      }

      if (vueViewers.indexOf(component) >= 0) {
        return vueViewerMap[component]
      } else{
        console.error('Error loading viewer')
        return ['UnknownViewer']
      }

    },

    isCollectionWithAViewer: function(pkg) {
      const packageType = pathOr('', ['content', 'packageType'], pkg)
      if (packageType !== 'Collection') {
        return false
      }
      const packageProperties = propOr([], 'properties', pkg)
      const collectionSubtype = this.getFilePropertyVal(packageProperties, 'subtype', 'Viewer')
      const isTimeseriesCollection = collectionSubtype.toLowerCase() === 'pennsieve_timeseries';
      return isTimeseriesCollection
    },
    isOMETiff: function(pkg) {
      const fileName = pathOr('', ['content', 'name'], pkg).toLowerCase()
      return fileName.endsWith('.ome.tiff') || fileName.endsWith('.ome.tif')
    },
    isParquetFile: function(pkg) {
      const fileName = pathOr('', ['content', 'name'], pkg).toLowerCase()
      return fileName.endsWith('.parquet')
    }
  }


}
