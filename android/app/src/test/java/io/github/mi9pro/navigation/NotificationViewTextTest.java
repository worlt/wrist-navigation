package io.github.mi9pro.navigation;

import java.util.List;
import org.junit.Test;
import static org.junit.Assert.*;

public class NotificationViewTextTest {
    private static final class Node {
        final String text; final boolean visible; final List<Node> children;
        Node(String text, boolean visible, Node... children) { this.text = text; this.visible = visible; this.children = List.of(children); }
    }
    private final NotificationViewText.Access<Node> access = new NotificationViewText.Access<>() {
        public boolean visible(Node node) { return node.visible; }
        public CharSequence text(Node node) { return node.text; }
        public int childCount(Node node) { return node.children.size(); }
        public Node child(Node node, int index) { return node.children.get(index); }
    };
    @Test public void readsVisibleTextInTreeOrderWithoutHiddenOldInstructions() {
        var result = NotificationViewText.collect(new Node(null, true,
            new Node("左转进入旧路", false), new Node("直行617米", true),
            new Node(null, false, new Node("右转", true))), access);
        assertArrayEquals(new String[]{"直行617米"}, result.fields);
        assertTrue(result.complete);
    }
    @Test public void boundedTreesAreMarkedIncompleteInsteadOfParsingPartialEvidence() {
        Node nested = new Node("直行617米", true);
        for (int n = 0; n < NotificationViewText.MAX_DEPTH + 2; n++) nested = new Node(null, true, nested);
        assertFalse(NotificationViewText.collect(nested, access).complete);
        Node[] wide = new Node[NotificationViewText.MAX_NODES + 2];
        for (int n = 0; n < wide.length; n++) wide[n] = new Node(null, true);
        var result = NotificationViewText.collect(new Node(null, true, wide), access);
        assertFalse(result.complete);
        assertTrue(result.visited <= NotificationViewText.MAX_NODES);
    }
    @Test public void oversizedTextAndTooManyLabelsNeverLookComplete() {
        var longText = NotificationViewText.collect(new Node("示例".repeat(600), true), access);
        assertFalse(longText.complete);
        assertTrue(longText.fields[0].length() <= NotificationViewText.MAX_TEXT);
        Node[] nodes = new Node[NotificationViewText.MAX_FIELDS + 1];
        for (int n = 0; n < nodes.length; n++) nodes[n] = new Node("标签" + n, true);
        var result = NotificationViewText.collect(new Node(null, true, nodes), access);
        assertFalse(result.complete);
        assertEquals(NotificationViewText.MAX_FIELDS, result.fields.length);
    }
}
