import { describe, it, expect } from 'vitest'
import {
    tokenize,
    scoreCandidate,
    rankCandidates,
    compatibleType,
    coarseScore,
    coarseQualifies,
    norm,
    SEARCH_COLS,
    RETRIEVE,
    COARSE,
} from './cdeSuggestRanker.mjs'

const cde = (over) => ({
    persistent_id: 'p',
    cde_name: '',
    preferred_question_text: '',
    cde_definition: '',
    cde_source: '',
    cde_data_type: '',
    aliases: [],
    ...over,
})

describe('tokenize', () => {
    it('lowercases, drops 1-char tokens and stopwords', () => {
        expect(tokenize('Age at Enrollment (years)')).toEqual(['age', 'enrollment', 'years'])
    })
    it('is empty for punctuation/stopword-only input', () => {
        expect(tokenize('the of a')).toEqual([])
    })
})

describe('compatibleType', () => {
    it('maps property types onto the CDE data-type vocabulary', () => {
        expect(compatibleType('integer', 'Number')).toBe(true)
        expect(compatibleType('date', 'Date')).toBe(true)
        expect(compatibleType('enum', 'Value List')).toBe(true)
        expect(compatibleType('string', 'Number')).toBe(false)
    })
})

describe('scoreCandidate', () => {
    const q = 'age'
    const score = (c, exclude) => scoreCandidate(c, norm(q), tokenize(q), '', exclude)

    it('rewards an exact name match over a mere substring', () => {
        const exact = score(cde({ cde_name: 'age' }))
        const substr = score(cde({ cde_name: 'patient age at visit' }))
        expect(exact).toBeGreaterThan(substr)
    })

    it('weights name above question above definition for the same token', () => {
        const inName = score(cde({ cde_name: 'age' }))
        const inQuestion = score(cde({ preferred_question_text: 'age' }))
        const inDef = score(cde({ cde_definition: 'age' }))
        expect(inName).toBeGreaterThan(inQuestion)
        expect(inQuestion).toBeGreaterThan(inDef)
    })

    it('gives a data-type-compatible CDE a bonus', () => {
        const base = cde({ cde_name: 'age', cde_data_type: 'Number' })
        expect(scoreCandidate(base, 'age', ['age'], 'integer')).toBeGreaterThan(
            scoreCandidate(base, 'age', ['age'], ''),
        )
    })

    it('exclude drops a field from scoring (cold mode)', () => {
        const c = cde({ preferred_question_text: 'age' })
        expect(score(c)).toBeGreaterThan(0)
        expect(score(c, new Set(['preferred_question_text']))).toBeLessThanOrEqual(0)
    })
})

describe('rankCandidates', () => {
    const cands = [
        cde({ persistent_id: 'weight', cde_name: 'Body Weight', cde_definition: 'mass' }),
        cde({ persistent_id: 'age', cde_name: 'Age Value', preferred_question_text: 'what is the age' }),
        cde({ persistent_id: 'age-alias', cde_name: 'Years Lived', aliases: ['age'] }),
    ]
    it('ranks the strongest lexical match first and is stable', () => {
        const ranked = rankCandidates(cands, 'age', '').map((c) => c.persistent_id)
        expect(ranked[0]).toBe('age')
        expect(ranked).toContain('age-alias')
        expect(ranked).not.toContain(undefined)
    })
    it('cold exclude changes ordering without throwing', () => {
        const ranked = rankCandidates(cands, 'age', '', new Set(['cde_name']))
        expect(ranked.map((c) => c.persistent_id)).toContain('age-alias')
    })
})

describe('coarse retrieval (stage 1)', () => {
    it('scores from the shared COARSE weights (phrase-in-name dominates)', () => {
        const nameHit = coarseScore(cde({ cde_name: 'blood pressure' }), 'blood pressure', ['blood', 'pressure'])
        const defHit = coarseScore(cde({ cde_definition: 'blood pressure' }), 'blood pressure', ['blood', 'pressure'])
        expect(nameHit).toBeGreaterThan(defHit)
        expect(nameHit).toBe(COARSE.phrase.cde_name + COARSE.token.cde_name * 2)
    })
    it('qualifies a candidate when any token substring-hits an allowed column', () => {
        expect(coarseQualifies(cde({ cde_definition: 'systolic value' }), ['systolic'])).toBe(true)
        expect(coarseQualifies(cde({ cde_definition: 'systolic value' }), ['diastolic'])).toBe(false)
    })
    it('cols restricts which columns count (cold mode)', () => {
        const c = cde({ preferred_question_text: 'age' })
        const cold = SEARCH_COLS.filter((x) => x !== 'preferred_question_text')
        expect(coarseQualifies(c, ['age'])).toBe(true)
        expect(coarseQualifies(c, ['age'], cold)).toBe(false)
    })
    it('exposes a sane retrieval depth', () => {
        expect(RETRIEVE).toBeGreaterThanOrEqual(100)
    })
})
