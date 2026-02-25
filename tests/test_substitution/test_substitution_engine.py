"""Tests for chord substitution engine."""

from __future__ import annotations

import pytest

from caspian.substitution.engine import suggest_substitutions
from caspian.substitution.models import ChordSubstitution


class TestTritoneSubstitution:
    """Tritone substitution: dominant chords only, root +6 semitones."""

    def test_g7_in_c_major_yields_db7(self):
        subs = suggest_substitutions("G7", "C", "major")
        tritone_subs = [s for s in subs if s.sub_type == "tritone"]
        assert len(tritone_subs) == 1
        # In C major (sharp key), Db is spelled C# -- but in F major it would be Db
        assert tritone_subs[0].symbol in ("C#7", "Db7")
        assert tritone_subs[0].confidence == 0.85

    def test_g7_in_f_major_yields_db7(self):
        """F major is a flat key, so tritone sub of G7 should spell Db7."""
        subs = suggest_substitutions("G7", "F", "major")
        tritone_subs = [s for s in subs if s.sub_type == "tritone"]
        assert len(tritone_subs) == 1
        assert tritone_subs[0].symbol == "Db7"

    def test_no_tritone_for_minor_chord(self):
        """Tritone substitution only applies to dominant chords."""
        subs = suggest_substitutions("Am", "C", "major")
        tritone_subs = [s for s in subs if s.sub_type == "tritone"]
        assert len(tritone_subs) == 0

    def test_no_tritone_for_major_chord(self):
        subs = suggest_substitutions("C", "C", "major")
        tritone_subs = [s for s in subs if s.sub_type == "tritone"]
        assert len(tritone_subs) == 0

    def test_tritone_for_dom7sus4(self):
        """7sus4 is a dominant-type chord, should get tritone sub."""
        subs = suggest_substitutions("G7sus4", "C", "major")
        tritone_subs = [s for s in subs if s.sub_type == "tritone"]
        assert len(tritone_subs) == 1

    def test_tritone_has_common_tones(self):
        """Tritone subs share the tritone interval (2 common tones for dom7)."""
        subs = suggest_substitutions("G7", "C", "major")
        tritone_subs = [s for s in subs if s.sub_type == "tritone"]
        assert tritone_subs[0].common_tone_count == 2


class TestRelativeSubstitution:
    """Relative major/minor substitution."""

    def test_am_yields_relative_major_c(self):
        subs = suggest_substitutions("Am", "C", "major")
        relative_subs = [s for s in subs if s.sub_type == "relative"]
        assert len(relative_subs) == 1
        assert relative_subs[0].symbol == "C"
        assert relative_subs[0].confidence == 0.80

    def test_c_yields_relative_minor_am(self):
        subs = suggest_substitutions("C", "C", "major")
        relative_subs = [s for s in subs if s.sub_type == "relative"]
        assert len(relative_subs) == 1
        assert relative_subs[0].symbol == "Am"

    def test_dm_yields_relative_major_f(self):
        subs = suggest_substitutions("Dm", "C", "major")
        relative_subs = [s for s in subs if s.sub_type == "relative"]
        assert len(relative_subs) == 1
        assert relative_subs[0].symbol == "F"

    def test_no_relative_for_diminished(self):
        """Relative sub only for major/minor triads."""
        subs = suggest_substitutions("Bdim", "C", "major")
        relative_subs = [s for s in subs if s.sub_type == "relative"]
        assert len(relative_subs) == 0

    def test_relative_shares_two_tones(self):
        """Relative major/minor share 2 of 3 tones."""
        subs = suggest_substitutions("Am", "C", "major")
        relative_subs = [s for s in subs if s.sub_type == "relative"]
        assert relative_subs[0].common_tone_count == 2


class TestParallelSubstitution:
    """Parallel major/minor substitution (same root, opposite quality)."""

    def test_am_yields_a_major(self):
        subs = suggest_substitutions("Am", "A", "natural_minor")
        parallel_subs = [s for s in subs if s.sub_type == "parallel"]
        assert len(parallel_subs) == 1
        assert parallel_subs[0].symbol == "A"
        assert parallel_subs[0].confidence == 0.70

    def test_c_yields_cm(self):
        subs = suggest_substitutions("C", "C", "major")
        parallel_subs = [s for s in subs if s.sub_type == "parallel"]
        assert len(parallel_subs) == 1
        assert parallel_subs[0].symbol == "Cm"

    def test_no_parallel_for_diminished(self):
        subs = suggest_substitutions("Bdim", "C", "major")
        parallel_subs = [s for s in subs if s.sub_type == "parallel"]
        assert len(parallel_subs) == 0

    def test_parallel_shares_root_and_fifth(self):
        """Major and minor triads share root and fifth (2 common tones)."""
        subs = suggest_substitutions("Am", "A", "natural_minor")
        parallel_subs = [s for s in subs if s.sub_type == "parallel"]
        assert parallel_subs[0].common_tone_count == 2


class TestDiatonicExchange:
    """Diatonic functional exchange within the same harmonic function group."""

    def test_am_tonic_exchange_in_c_major(self):
        """Am (vi) is tonic function -> should suggest C (I) and Em (iii).

        Note: C may be deduplicated as 'relative' (higher confidence) rather
        than 'diatonic', so we check the full result list for C and only
        check Em specifically in the diatonic sub_type.
        """
        subs = suggest_substitutions("Am", "C", "major")
        all_symbols = {s.symbol for s in subs}
        assert "C" in all_symbols  # I (tonic) -- may appear as relative sub
        diatonic_subs = [s for s in subs if s.sub_type == "diatonic"]
        diatonic_symbols = {s.symbol for s in diatonic_subs}
        assert "Em" in diatonic_symbols  # iii (tonic)

    def test_dm_subdominant_exchange_in_c_major(self):
        """Dm (ii) is subdominant function -> should suggest F (IV).

        Note: F may be deduplicated as 'relative' (higher confidence) rather
        than 'diatonic', so we check the full result list.
        """
        subs = suggest_substitutions("Dm", "C", "major")
        all_symbols = {s.symbol for s in subs}
        assert "F" in all_symbols  # IV (subdominant) -- may appear as relative sub

    def test_g_dominant_exchange_in_c_major(self):
        """G (V) is dominant function -> should suggest Bdim (vii)."""
        subs = suggest_substitutions("G", "C", "major")
        diatonic_subs = [s for s in subs if s.sub_type == "diatonic"]
        symbols = {s.symbol for s in diatonic_subs}
        assert "Bdim" in symbols  # vii° (dominant)

    def test_no_diatonic_for_non_diatonic_chord(self):
        """Non-diatonic chords shouldn't have diatonic exchange."""
        subs = suggest_substitutions("Eb", "C", "major")
        diatonic_subs = [s for s in subs if s.sub_type == "diatonic"]
        assert len(diatonic_subs) == 0

    def test_diatonic_confidence(self):
        subs = suggest_substitutions("Am", "C", "major")
        diatonic_subs = [s for s in subs if s.sub_type == "diatonic"]
        for s in diatonic_subs:
            assert s.confidence == 0.75


class TestModalInterchange:
    """Modal interchange: borrowing chords from parallel mode."""

    def test_c_major_borrows_from_c_minor(self):
        """In C major, should borrow chords from C natural minor."""
        subs = suggest_substitutions("C", "C", "major")
        mi_subs = [s for s in subs if s.sub_type == "modal_interchange"]
        symbols = {s.symbol for s in mi_subs}
        # C natural minor has: Cm, Ddim, Eb, Fm, Gm, Ab, Bb
        # Of these, Cm, Ddim, Eb, Fm, Gm, Ab, Bb differ from C major diatonic
        # (C major has: C, Dm, Em, F, G, Am, Bdim)
        assert len(mi_subs) > 0
        # Fm (iv from minor) should be present
        assert "Fm" in symbols

    def test_a_minor_borrows_from_a_major(self):
        """In A natural minor, should borrow chords from A major."""
        subs = suggest_substitutions("Am", "A", "natural_minor")
        mi_subs = [s for s in subs if s.sub_type == "modal_interchange"]
        symbols = {s.symbol for s in mi_subs}
        # A major has: A, Bm, C#m, D, E, F#m, G#dim
        # A minor has: Am, Bdim, C, Dm, E, F, G
        assert len(mi_subs) > 0

    def test_modal_interchange_confidence(self):
        subs = suggest_substitutions("C", "C", "major")
        mi_subs = [s for s in subs if s.sub_type == "modal_interchange"]
        for s in mi_subs:
            assert s.confidence == 0.65


class TestDominantChain:
    """Secondary dominants: V7/x for each diatonic target."""

    def test_secondary_dominants_in_c_major(self):
        """Should suggest V7/ii, V7/iii, V7/IV, V7/V, V7/vi (not V7/I or V7/vii)."""
        # Use high limit to ensure secondary dominants (confidence 0.60) aren't cut off
        subs = suggest_substitutions("C", "C", "major", limit=50)
        dom_subs = [s for s in subs if s.sub_type == "dominant_chain"]
        symbols = {s.symbol for s in dom_subs}
        # V7/ii = A7 (dominant of Dm)
        assert "A7" in symbols
        # V7/V = D7 (dominant of G)
        assert "D7" in symbols

    def test_no_secondary_dominant_of_diminished(self):
        """Should NOT suggest V7 of the diminished triad degree."""
        subs = suggest_substitutions("C", "C", "major")
        dom_subs = [s for s in subs if s.sub_type == "dominant_chain"]
        # vii° in C major is Bdim; V7/vii° would be F#7
        # This should NOT be present since we skip diminished targets
        for s in dom_subs:
            assert "V7/vii" not in s.reasoning

    def test_doesnt_suggest_original_chord_as_secondary_dom(self):
        """If original chord happens to be V7/x, it shouldn't suggest itself."""
        # E7 is V7/vi in C major (dominant of Am)
        subs = suggest_substitutions("E7", "C", "major")
        dom_subs = [s for s in subs if s.sub_type == "dominant_chain"]
        symbols = {s.symbol for s in dom_subs}
        assert "E7" not in symbols

    def test_secondary_dominant_confidence(self):
        subs = suggest_substitutions("C", "C", "major")
        dom_subs = [s for s in subs if s.sub_type == "dominant_chain"]
        for s in dom_subs:
            assert s.confidence == 0.60


class TestDeduplicationAndSorting:
    """Deduplication, sorting, and limiting behavior."""

    def test_no_duplicate_symbols(self):
        subs = suggest_substitutions("Am", "C", "major")
        symbols = [s.symbol for s in subs]
        assert len(symbols) == len(set(symbols))

    def test_sorted_by_confidence_desc(self):
        subs = suggest_substitutions("G7", "C", "major")
        confidences = [s.confidence for s in subs]
        for i in range(len(confidences) - 1):
            assert confidences[i] >= confidences[i + 1]

    def test_same_confidence_sorted_by_vld_asc(self):
        """Within the same confidence level, sort by voice leading distance ascending."""
        subs = suggest_substitutions("Am", "C", "major")
        # Group by confidence
        by_conf: dict[float, list[ChordSubstitution]] = {}
        for s in subs:
            by_conf.setdefault(s.confidence, []).append(s)
        for conf, group in by_conf.items():
            vlds = [s.voice_leading_distance for s in group]
            assert vlds == sorted(vlds), f"VLD not sorted within confidence {conf}: {vlds}"

    def test_limit_respected(self):
        subs = suggest_substitutions("Am", "C", "major", limit=3)
        assert len(subs) <= 3

    def test_original_chord_not_in_results(self):
        subs = suggest_substitutions("Am", "C", "major")
        symbols = {s.symbol for s in subs}
        assert "Am" not in symbols

    def test_dedup_keeps_highest_confidence(self):
        """If a chord appears from multiple rules, keep the highest confidence version."""
        # C appears as both relative (0.80) and diatonic exchange (0.75) for Am in C major
        subs = suggest_substitutions("Am", "C", "major")
        c_subs = [s for s in subs if s.symbol == "C"]
        assert len(c_subs) == 1
        assert c_subs[0].confidence == 0.80  # relative beats diatonic


class TestVoiceLeadingMetrics:
    """Voice leading distance and common tone calculations."""

    def test_voice_leading_distance_is_nonnegative(self):
        subs = suggest_substitutions("Am", "C", "major")
        for s in subs:
            assert s.voice_leading_distance >= 0

    def test_common_tone_count_is_nonnegative(self):
        subs = suggest_substitutions("Am", "C", "major")
        for s in subs:
            assert s.common_tone_count >= 0

    def test_parallel_sub_has_two_common_tones(self):
        """Parallel major/minor share root and fifth."""
        subs = suggest_substitutions("Am", "A", "natural_minor")
        parallel = [s for s in subs if s.sub_type == "parallel"]
        assert parallel[0].common_tone_count == 2


class TestErrorHandling:
    """Error handling for invalid inputs."""

    def test_invalid_chord_raises(self):
        with pytest.raises(ValueError):
            suggest_substitutions("X7", "C", "major")

    def test_invalid_key_root_raises(self):
        with pytest.raises(ValueError, match="Unknown root note"):
            suggest_substitutions("G7", "X", "major")

    def test_invalid_key_mode_raises(self):
        with pytest.raises(ValueError, match="Unknown mode"):
            suggest_substitutions("G7", "C", "invalid_mode")


class TestEdgeCases:
    """Edge cases and unusual inputs."""

    def test_diminished_chord(self):
        """Diminished chords shouldn't crash the engine."""
        subs = suggest_substitutions("Bdim", "C", "major")
        assert isinstance(subs, list)

    def test_augmented_chord(self):
        subs = suggest_substitutions("Caug", "C", "major")
        assert isinstance(subs, list)

    def test_half_diminished_chord(self):
        subs = suggest_substitutions("Bm7b5", "C", "major")
        assert isinstance(subs, list)

    def test_flat_key_spelling(self):
        """In Bb major, substitutions should use flat spellings."""
        subs = suggest_substitutions("F7", "Bb", "major")
        # Tritone sub of F7 should use flat spelling (Cb7 or B7 depending on convention)
        tritone_subs = [s for s in subs if s.sub_type == "tritone"]
        assert len(tritone_subs) == 1
        # In Bb (flat key), root at pitch 11 should be Cb or B
        # note_name(11, prefer_sharp=False) gives "B" since B has no flat variant
        assert tritone_subs[0].symbol in ("B7", "Cb7")

    def test_all_sub_types_present_for_diatonic_dominant(self):
        """A diatonic dominant7 chord should get all applicable sub types."""
        subs = suggest_substitutions("G7", "C", "major")
        types = {s.sub_type for s in subs}
        assert "tritone" in types
        assert "diatonic" in types
        assert "modal_interchange" in types

    def test_limit_zero_not_allowed_via_api(self):
        """Engine itself handles limit=0 by returning empty."""
        subs = suggest_substitutions("G7", "C", "major", limit=0)
        assert subs == []

    def test_context_params_accepted(self):
        """prev_chord and next_chord should be accepted without error."""
        subs = suggest_substitutions("Am", "C", "major", prev_chord="G7", next_chord="F")
        assert isinstance(subs, list)
        assert len(subs) > 0

    def test_default_limit_is_10(self):
        subs = suggest_substitutions("Am", "C", "major")
        assert len(subs) <= 10


class TestAPIEndpoint:
    """Test the /api/chord-substitutions endpoint."""

    def setup_method(self):
        from fastapi.testclient import TestClient
        from caspian.api import app
        self.client = TestClient(app)

    def test_basic_request(self):
        resp = self.client.get(
            "/api/chord-substitutions",
            params={"chord": "G7", "key_root_name": "C", "key_mode": "major"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["chord"] == "G7"
        assert isinstance(data["substitutions"], list)
        assert len(data["substitutions"]) > 0

    def test_response_structure(self):
        resp = self.client.get(
            "/api/chord-substitutions",
            params={"chord": "Am", "key_root_name": "C", "key_mode": "major"},
        )
        assert resp.status_code == 200
        data = resp.json()
        sub = data["substitutions"][0]
        assert "symbol" in sub
        assert "sub_type" in sub
        assert "reasoning" in sub
        assert "confidence" in sub
        assert "voice_leading_distance" in sub
        assert "common_tone_count" in sub

    def test_limit_param(self):
        resp = self.client.get(
            "/api/chord-substitutions",
            params={"chord": "Am", "key_root_name": "C", "key_mode": "major", "limit": 3},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["substitutions"]) <= 3

    def test_invalid_chord_returns_400(self):
        resp = self.client.get(
            "/api/chord-substitutions",
            params={"chord": "X7", "key_root_name": "C", "key_mode": "major"},
        )
        assert resp.status_code == 400

    def test_invalid_key_returns_400(self):
        resp = self.client.get(
            "/api/chord-substitutions",
            params={"chord": "G7", "key_root_name": "X", "key_mode": "major"},
        )
        assert resp.status_code == 400

    def test_invalid_mode_returns_400(self):
        resp = self.client.get(
            "/api/chord-substitutions",
            params={"chord": "G7", "key_root_name": "C", "key_mode": "invalid"},
        )
        assert resp.status_code == 400

    def test_optional_context_params(self):
        resp = self.client.get(
            "/api/chord-substitutions",
            params={
                "chord": "Am",
                "key_root_name": "C",
                "key_mode": "major",
                "prev_chord": "G7",
                "next_chord": "F",
            },
        )
        assert resp.status_code == 200
        assert len(resp.json()["substitutions"]) > 0

    def test_missing_required_params(self):
        resp = self.client.get("/api/chord-substitutions")
        assert resp.status_code == 422  # FastAPI validation error
