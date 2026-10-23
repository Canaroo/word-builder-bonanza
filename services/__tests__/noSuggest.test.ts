// Words in words/no-suggest.txt are valid when typed but never offered by the game.
import { describe, test, expect } from 'vitest';
import { curatedWords, suggestableWords, NO_SUGGEST_WORDS, isBlocked } from '../curatedWords';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('playable but never suggested', () => {
    test('COON is playable with its raccoon definition', () => {
        expect(isBlocked('coon')).toBe(false);
        expect(curatedWords.get('coon')).toBe('A raccoon.');
        const list = new Set(readFileSync(resolve(__dirname, '../../public/words/wordlist.txt'), 'utf8').split('\n'));
        expect(list.has('coon')).toBe(true);
        expect(list.has('coons')).toBe(true);
    });

    test('DINK is playable as a drop shot, and never suggested', () => {
        expect(curatedWords.get('dink')).toBe('A drop shot.');
        const list = new Set(readFileSync(resolve(__dirname, '../../public/words/wordlist.txt'), 'utf8').split('\n'));
        expect(list.has('dink')).toBe(true);
        expect(suggestableWords.has('dink')).toBe(false);
    });

    test('FAG and its verb forms are playable with definitions and never suggested', () => {
        const list = new Set(readFileSync(resolve(__dirname, '../../public/words/wordlist.txt'), 'utf8').split('\n'));
        for (const [w, d] of [['fag', 'To make weary by hard work.'], ['fags', 'Makes weary by hard work.'], ['fagged', 'Made weary by hard work.'], ['fagging', 'Making weary by hard work.']]) {
            expect(isBlocked(w)).toBe(false);
            expect(list.has(w)).toBe(true);
            expect(curatedWords.get(w)).toBe(d);
            expect(suggestableWords.has(w)).toBe(false);
        }
        expect(isBlocked('faggot')).toBe(true);
    });

    test('CROWBAR has its definition', () => {
        expect(curatedWords.get('crowbar')).toBe('To use a steel bar as a lever.');
    });

    test('no-suggest words are never Power Words, hints or Challenge answers', () => {
        expect(NO_SUGGEST_WORDS.has('coon')).toBe(true);
        for (const w of NO_SUGGEST_WORDS) expect(suggestableWords.has(w)).toBe(false);
        const common = new Set(readFileSync(resolve(__dirname, '../../public/words/common.txt'), 'utf8').split('\n'));
        for (const w of NO_SUGGEST_WORDS) expect(common.has(w)).toBe(false);
    });
});

describe('added words', () => {
    test('NWL2023 words added for common play are valid, unblocked and defined', () => {
        const list = new Set(readFileSync(resolve(__dirname, '../../public/words/wordlist.txt'), 'utf8').split('\n'));
        const words = 'bae baes stan stans stanned stanning sitch sitches welp yeehaw yowza vibed vibing inspo inspos skeezy thingie thingies yas fav favs ack eew grr mmm folx owie owies outie outies poo poos oma omas opa opas xed dox doxed doxes doxing doxx doxxed doxxes doxxing unfollow unfollows unfollowed unfollowing unsub unsubs unsubbed unsubbing unmute unmutes unmuted unmuting subtweet subtweets subtweeted subtweeting fintech fintechs embiggen embiggens embiggened embiggening torrented torrenting deadname deadnames deadnamed deadnaming allyship allyships org orgs sig sigs guac guacs matcha matchas horchata horchatas zoodle zoodles slushee slushees hygge vax vaxes vaxed vaxing vaxx adulted adulting babymoon babymoons fauxhawk fauxhawks caf cafs cal cals nug nugs soju sojus zuke zukes mpox zens'.split(' ');
        expect(words.length).toBe(113);
        for (const w of words) {
            expect(list.has(w), w).toBe(true);
            expect(isBlocked(w), w).toBe(false);
            expect(curatedWords.get(w), w).toBeTruthy();
        }
    });

    test('FAM and FAMS are valid with definitions', () => {
        const list = new Set(readFileSync(resolve(__dirname, '../../public/words/wordlist.txt'), 'utf8').split('\n'));
        expect(list.has('fam') && list.has('fams')).toBe(true);
        expect(curatedWords.get('fam')).toBe('Family; also, your closest friends.');
    });
});
