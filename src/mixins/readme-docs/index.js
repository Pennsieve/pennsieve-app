import Request from '../../mixins/request/index'
import {mapGetters} from "vuex";

export default  {
    mixins: [
        Request
    ],
    computed: {
        ...mapGetters([
            "config",
            'userToken'
            ]),
    },
    data() {
        return {
            summary: ''
        }

    },
    methods: {
        getReadmeDocument: function(slug) {
            const url = `${this.config.api2Url}/readme/docs/${slug}`

             this.sendXhr(url, {
                method: 'GET',
                header: {
                    'Authorization': `Bearer ${this.userToken}`
                },
            }).then( result => {
                this.summary = result
             })
        }
    }
}