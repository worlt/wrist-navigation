package io.github.mi9pro.navigation;

import java.util.ArrayList;
import java.util.List;

/** Bounded traversal of unattached views; getVisibility is used rather than isShown. */
final class NotificationViewText {
    static final int MAX_NODES = 128, MAX_DEPTH = 12, MAX_FIELDS = 32, MAX_TEXT = 512;
    interface Access<N> {
        boolean visible(N node);
        CharSequence text(N node);
        int childCount(N node);
        N child(N node, int index);
    }
    static final class Text {
        final String[] fields; final boolean complete; final int visited;
        Text(State state) {
            fields = state.fields.toArray(new String[0]); complete = state.complete; visited = state.visited;
        }
    }
    private static final class State {
        final List<String> fields = new ArrayList<>();
        int visited; boolean complete = true;
    }
    static <N> Text collect(N root, Access<N> access) {
        State state = new State();
        visit(root, access, state, 0);
        return new Text(state);
    }
    private static <N> void visit(N node, Access<N> access, State state, int depth) {
        if (node == null) return;
        if (depth > MAX_DEPTH || state.visited >= MAX_NODES) { state.complete = false; return; }
        state.visited++;
        if (!access.visible(node)) return;
        CharSequence value = access.text(node);
        if (value != null && value.length() > 0) {
            if (state.fields.size() >= MAX_FIELDS) { state.complete = false; return; }
            if (value.length() > MAX_TEXT) state.complete = false;
            state.fields.add(NavigationParser.clip(value.subSequence(0, Math.min(value.length(), MAX_TEXT + 1)).toString(), MAX_TEXT));
        }
        int count = access.childCount(node);
        for (int index = 0; index < count; index++) {
            if (state.visited >= MAX_NODES || state.fields.size() >= MAX_FIELDS) { state.complete = false; break; }
            visit(access.child(node, index), access, state, depth + 1);
        }
    }
}
